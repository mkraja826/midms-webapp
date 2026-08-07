import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractText(payload: any): string {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string" && content.text.trim()) return content.text.trim();
      if (typeof content?.output_text === "string" && content.output_text.trim()) return content.output_text.trim();
    }
  }

  return "";
}

async function callGrok(input: { apiKey: string; model: string; system: string; user: string; maxOutputTokens: number }) {
  const response = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      input: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      max_output_tokens: input.maxOutputTokens,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("xAI request failed", response.status, payload);
    throw new Error(`XAI_REQUEST_FAILED:${response.status}`);
  }

  return extractText(payload);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.action || !["ping", "today_summary"].includes(body.action)) {
    return json({ error: "Unsupported CapDent AI action." }, 400);
  }

  const apiKey = Deno.env.get("XAI_API_KEY")?.trim();
  if (!apiKey) {
    return json({ connected: false, provider: "xai", code: "XAI_API_KEY_MISSING", message: "CapDent AI is not configured." }, 503);
  }

  const model = Deno.env.get("XAI_MODEL")?.trim() || "grok-4.20";

  if (body.action === "ping") {
    try {
      const message = await callGrok({
        apiKey,
        model,
        system: "You are the connectivity check for CapDent AI. Do not request, infer, or discuss patient or clinic data. Return only the requested confirmation sentence.",
        user: "Reply exactly: CapDent AI connected successfully.",
        maxOutputTokens: 64,
      });
      return json({ connected: true, provider: "xai", model, message: message || "CapDent AI connected successfully." });
    } catch (error) {
      console.error("CapDent AI ping failed", error);
      return json({ connected: false, provider: "xai", model, code: "XAI_REQUEST_FAILED", message: "Grok connection test failed." }, 502);
    }
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!authorization || !supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Authenticated CapDent session required." }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "Authenticated CapDent session required." }, 401);
  }

  const { data: summaryRows, error: summaryError } = await supabase.rpc("get_capdent_ai_today_summary");
  if (summaryError) {
    console.error("CapDent AI today summary RPC failed", summaryError);
    return json({ error: "Unable to load today's clinic summary." }, 500);
  }

  const summary = Array.isArray(summaryRows) ? summaryRows[0] : null;
  if (!summary) return json({ error: "No active clinic summary is available for this account." }, 404);

  try {
    const answer = await callGrok({
      apiKey,
      model,
      system: [
        "You are CapDent AI, a read-only dental clinic operations assistant.",
        "Use only the aggregate clinic metrics supplied by CapDent.",
        "Never invent patient, financial, clinical, staff, or appointment details.",
        "Do not claim to have changed any record.",
        "Do not diagnose or prescribe.",
        "Be concise and practical. Distinguish today's collections from total outstanding dues.",
      ].join(" "),
      user: `Answer the question: How is my clinic doing today?\n\nCapDent aggregate context:\n${JSON.stringify(summary)}`,
      maxOutputTokens: 220,
    });

    return json({
      connected: true,
      provider: "xai",
      model,
      action: "today_summary",
      answer: answer || "Today's clinic summary is available.",
      summary,
      privacy: "aggregate_only",
      read_only: true,
    });
  } catch (error) {
    console.error("CapDent AI today summary generation failed", error);
    return json({ error: "Grok could not generate the clinic summary." }, 502);
  }
});
