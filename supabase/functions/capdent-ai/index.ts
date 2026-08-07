import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AnalyticsPeriod = "daily" | "tomorrow" | "weekly" | "monthly";

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

function cleanQuestion(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

function resolvePeriod(question: string, requested?: unknown): AnalyticsPeriod {
  if (["daily", "tomorrow", "weekly", "monthly"].includes(String(requested || ""))) {
    return requested as AnalyticsPeriod;
  }

  const value = question.toLowerCase();
  if (/\btomorrow\b/.test(value)) return "tomorrow";
  if (/\b(month|monthly|this month|last month)\b/.test(value)) return "monthly";
  if (/\b(week|weekly|this week|last week)\b/.test(value)) return "weekly";
  return "daily";
}

async function callGrok(input: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxOutputTokens: number;
}) {
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

  let body: { action?: string; question?: string; period?: AnalyticsPeriod } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.action || !["ping", "today_summary", "analytics"].includes(body.action)) {
    return json({ error: "Unsupported CapDent AI action." }, 400);
  }

  const apiKey = Deno.env.get("XAI_API_KEY")?.trim();
  if (!apiKey) {
    return json({
      connected: false,
      provider: "xai",
      code: "XAI_API_KEY_MISSING",
      message: "CapDent AI is not configured.",
    }, 503);
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

  const question = cleanQuestion(body.question) || "How is my clinic doing today?";
  const period: AnalyticsPeriod = body.action === "today_summary" ? "daily" : resolvePeriod(question, body.period);

  const rpcResult = period === "daily"
    ? await supabase.rpc("get_capdent_ai_today_summary")
    : await supabase.rpc("get_capdent_ai_period_analytics", { p_period: period });

  if (rpcResult.error) {
    console.error("CapDent AI analytics RPC failed", period, rpcResult.error);
    return json({ error: "Unable to load the requested clinic analytics." }, 500);
  }

  const summary = Array.isArray(rpcResult.data) ? rpcResult.data[0] : null;
  if (!summary) return json({ error: "No active clinic analytics are available for this account." }, 404);

  try {
    const answer = await callGrok({
      apiKey,
      model,
      system: [
        "You are CapDent AI, a read-only dental clinic operations assistant.",
        "Use only the aggregate clinic metrics supplied by CapDent.",
        "Never invent patient identities, financial details, diagnoses, treatment names, staff details, appointment details, or historical facts.",
        "The context may contain a current period and its immediately previous comparable period. Compare them only when useful or requested.",
        "If the requested information is not represented in the supplied aggregate metrics, say that capability is not available yet.",
        "If finance fields are null or can_view_finance is false, do not reveal, infer, estimate, or discuss clinic collections or dues.",
        "A field named outstanding_dues_now or outstanding_dues is the clinic's current lifetime outstanding balance, not a period-specific due amount.",
        "Do not claim to have changed any record. Do not diagnose or prescribe.",
        "Keep answers concise, practical, and suitable for a clinic dashboard chat.",
      ].join(" "),
      user: `Question: ${question}\nAnalytics scope: ${period}\n\nCapDent aggregate context:\n${JSON.stringify(summary)}`,
      maxOutputTokens: 280,
    });

    return json({
      connected: true,
      provider: "xai",
      model,
      action: "analytics",
      period,
      question,
      answer: answer || "The requested clinic analytics are available.",
      summary,
      privacy: "aggregate_only",
      read_only: true,
    });
  } catch (error) {
    console.error("CapDent AI analytics generation failed", error);
    return json({ error: "Grok could not generate the clinic analytics response." }, 502);
  }
});
