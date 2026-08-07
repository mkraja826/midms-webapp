import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (body.action !== "ping") {
    return json({ error: "Unsupported action. The first CapDent AI milestone only allows ping." }, 400);
  }

  const apiKey = Deno.env.get("XAI_API_KEY")?.trim();
  if (!apiKey) {
    return json({
      connected: false,
      provider: "xai",
      code: "XAI_API_KEY_MISSING",
      message: "CapDent AI backend is deployed. Add the XAI_API_KEY Edge Function secret to complete the Grok connection.",
    }, 503);
  }

  const model = Deno.env.get("XAI_MODEL")?.trim() || "grok-4.20";

  try {
    const response = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: "You are the connectivity check for CapDent AI. Do not request, infer, or discuss patient or clinic data. Return only the requested confirmation sentence.",
          },
          {
            role: "user",
            content: "Reply exactly: CapDent AI connected successfully.",
          },
        ],
        max_output_tokens: 64,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("xAI ping failed", response.status, payload);
      return json({
        connected: false,
        provider: "xai",
        model,
        code: "XAI_REQUEST_FAILED",
        message: "Grok connection test failed.",
        provider_status: response.status,
      }, 502);
    }

    const message = extractText(payload);
    return json({
      connected: true,
      provider: "xai",
      model,
      message: message || "CapDent AI connected successfully.",
    });
  } catch (error) {
    console.error("xAI ping exception", error);
    return json({
      connected: false,
      provider: "xai",
      model,
      code: "XAI_NETWORK_ERROR",
      message: "Unable to reach Grok from the CapDent AI backend.",
    }, 502);
  }
});
