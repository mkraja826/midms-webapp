import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AnalyticsPeriod = "daily" | "tomorrow" | "weekly" | "monthly";
type ProviderName = "groq" | "xai";
type ProviderFailure = Error & { status?: number; code?: string; provider?: ProviderName; model?: string };
type ProviderConfig = { name: ProviderName; apiKey: string; model: string; endpoint: string };
type AiResult = { text: string; provider: ProviderName; model: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function cleanQuestion(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function resolvePeriod(question: string, requested?: unknown): AnalyticsPeriod {
  if (["daily", "tomorrow", "weekly", "monthly"].includes(String(requested || ""))) return requested as AnalyticsPeriod;
  const value = question.toLowerCase();
  if (/\btomorrow\b/.test(value)) return "tomorrow";
  if (/\b(month|monthly|this month|last month)\b/.test(value)) return "monthly";
  if (/\b(week|weekly|this week|last week)\b/.test(value)) return "weekly";
  return "daily";
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(numberValue(value));
  } catch {
    return `${currency || "INR"} ${numberValue(value).toFixed(0)}`;
  }
}

function compactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function formatDate(value: unknown) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const [year, month, day] = text.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function inclusiveDays(start: unknown, end: unknown) {
  const a = Date.parse(`${String(start || "")}T00:00:00Z`);
  const b = Date.parse(`${String(end || "")}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.floor((b - a) / 86400000) + 1;
}

function changeLabel(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "no change" : "up from 0";
  const percent = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (percent === 0) return "about the same";
  return `${percent > 0 ? "up" : "down"} ${Math.abs(percent)}%`;
}

function normalizeAiText(value: string) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\|?\s*:?-{3,}/.test(line))
    .map((line) => {
      if (line.includes("|") && line.split("|").filter((cell) => cell.trim()).length >= 2) {
        const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
        return `• ${cells.join(" · ")}`;
      }
      return line.replace(/^[-*]\s+/, "• ");
    })
    .slice(0, 7)
    .join("\n")
    .slice(0, 1200);
}

function providerStatus(error: unknown) {
  const failure = error as ProviderFailure;
  return {
    status: typeof failure?.status === "number" ? failure.status : null,
    code: typeof failure?.code === "string" ? failure.code : null,
    provider: failure?.provider || null,
    model: failure?.model || null,
  };
}

function providersFromEnv(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  const groqKey = Deno.env.get("GROQ_API_KEY")?.trim();
  const xaiKey = Deno.env.get("XAI_API_KEY")?.trim();
  if (groqKey) providers.push({ name: "groq", apiKey: groqKey, model: Deno.env.get("GROQ_MODEL")?.trim() || "openai/gpt-oss-20b", endpoint: "https://api.groq.com/openai/v1/chat/completions" });
  if (xaiKey) providers.push({ name: "xai", apiKey: xaiKey, model: Deno.env.get("XAI_MODEL")?.trim() || "grok-4.20-non-reasoning", endpoint: "https://api.x.ai/v1/chat/completions" });
  return providers;
}

async function callProvider(provider: ProviderConfig, input: { system: string; user: string; maxOutputTokens: number }): Promise<AiResult> {
  let lastStatus = 0;
  let lastCode = "unknown";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "system", content: input.system }, { role: "user", content: input.user }],
        max_tokens: input.maxOutputTokens,
        temperature: 0.1,
        stream: false,
      }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      return { text: normalizeAiText(String(payload?.choices?.[0]?.message?.content || "")), provider: provider.name, model: provider.model };
    }
    lastStatus = response.status;
    lastCode = String(payload?.error?.code || payload?.code || payload?.error?.type || "unknown").slice(0, 120);
    console.error("CapDent AI provider request failed", { provider: provider.name, status: response.status, code: lastCode, model: provider.model, requestId: response.headers.get("x-request-id"), attempt: attempt + 1 });
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const error = new Error(`${provider.name.toUpperCase()}_REQUEST_FAILED:${lastStatus}`) as ProviderFailure;
  error.status = lastStatus;
  error.code = lastCode;
  error.provider = provider.name;
  error.model = provider.model;
  throw error;
}

async function callAi(providers: ProviderConfig[], input: { system: string; user: string; maxOutputTokens: number }): Promise<AiResult> {
  let lastError: unknown = null;
  for (const provider of providers) {
    try { return await callProvider(provider, input); }
    catch (error) {
      lastError = error;
      console.error("CapDent AI provider unavailable; trying fallback", providerStatus(error));
    }
  }
  throw lastError || new Error("NO_AI_PROVIDER_AVAILABLE");
}

function analyticsFacts(period: AnalyticsPeriod, question: string, summary: Record<string, unknown>) {
  const currency = String(summary.currency_code || "INR");
  if (period === "daily") {
    const facts = [
      `Date: ${formatDate(summary.local_date)}`,
      `Patients today: ${numberValue(summary.patients_today)}`,
      `New patients today: ${numberValue(summary.new_patients_today)}`,
      `Appointments today: ${numberValue(summary.appointments_today)}`,
      `Waiting now: ${numberValue(summary.waiting_count)}`,
      `Completed today: ${numberValue(summary.completed_count)}`,
      `Visits today: ${numberValue(summary.visits_today)}`,
      `Gallery uploads today: ${numberValue(summary.gallery_uploads_today)}`,
    ];
    if (summary.can_view_finance !== false && summary.net_collections_today != null) {
      facts.push(`Net collections today: ${money(summary.net_collections_today, currency)}`);
      facts.push(`Outstanding dues now: ${money(summary.outstanding_dues, currency)}`);
    }
    return facts.join("\n");
  }

  const currentDays = inclusiveDays(summary.period_start, summary.period_end);
  const previousDays = inclusiveDays(summary.previous_start, summary.previous_end);
  const wantsDaily = /\b(daily|per day|average|avg)\b/i.test(question);
  const facts = [
    `Comparison window: ${formatDate(summary.period_start)} to ${formatDate(summary.period_end)} (${currentDays} days) versus ${formatDate(summary.previous_start)} to ${formatDate(summary.previous_end)} (${previousDays} days).`,
    "These windows are already matched for a fair comparison. Never extend them to the full calendar week or month.",
  ];
  const metrics: Array<[string, unknown, unknown]> = [
    ["Patients", summary.patients_count, summary.previous_patients_count],
    ["New patients", summary.new_patients_count, summary.previous_new_patients_count],
    ["Appointments", summary.appointments_count, summary.previous_appointments_count],
    ["Completed appointments", summary.completed_count, summary.previous_completed_count],
    ["Visits", summary.visits_count, summary.previous_visits_count],
    ["Treatments", summary.treatments_count, summary.previous_treatments_count],
    ["Gallery uploads", summary.gallery_uploads_count, summary.previous_gallery_uploads_count],
  ];
  for (const [label, currentRaw, previousRaw] of metrics) {
    const current = numberValue(currentRaw);
    const previous = numberValue(previousRaw);
    if (wantsDaily) facts.push(`${label} per day: ${compactNumber(current / currentDays)} vs ${compactNumber(previous / previousDays)} (${changeLabel(current / currentDays, previous / previousDays)}).`);
    else facts.push(`${label}: ${compactNumber(current)} vs ${compactNumber(previous)} (${changeLabel(current, previous)}).`);
  }
  if (summary.can_view_finance !== false && summary.net_collections != null) {
    const current = numberValue(summary.net_collections);
    const previous = numberValue(summary.previous_net_collections);
    if (wantsDaily) facts.push(`Net collections per day: ${money(current / currentDays, currency)} vs ${money(previous / previousDays, currency)} (${changeLabel(current / currentDays, previous / previousDays)}).`);
    else facts.push(`Net collections: ${money(current, currency)} vs ${money(previous, currency)} (${changeLabel(current, previous)}).`);
    facts.push(`Outstanding dues now: ${money(summary.outstanding_dues_now, currency)}. This is a current lifetime balance, not a period total.`);
  }
  return facts.join("\n");
}

function analyticsFallback(period: AnalyticsPeriod, question: string, summary: Record<string, unknown>) {
  const facts = analyticsFacts(period, question, summary)
    .split("\n")
    .filter((line) => !line.startsWith("These windows"))
    .slice(0, 5)
    .map((line) => `• ${line}`);
  return ["CapDent records:", ...facts].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { action?: string; question?: string; period?: AnalyticsPeriod; patient_id?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (!body.action || !["ping", "today_summary", "analytics", "patient_history", "patient_dental_chart"].includes(body.action)) return json({ error: "Unsupported CapDent AI action." }, 400);

  const providers = providersFromEnv();
  if (!providers.length) return json({ connected: false, provider: null, code: "AI_PROVIDER_KEY_MISSING", message: "CapDent AI is not configured." }, 503);

  if (body.action === "ping") {
    try {
      const result = await callAi(providers, { system: "Return only the requested confirmation sentence.", user: "Reply exactly: CapDent AI connected successfully.", maxOutputTokens: 40 });
      return json({ connected: true, provider: result.provider, model: result.model, message: result.text || "CapDent AI connected successfully." });
    } catch (error) {
      const diagnostic = providerStatus(error);
      return json({ connected: false, provider: diagnostic.provider, model: diagnostic.model, code: "AI_PROVIDER_REQUEST_FAILED", provider_status: diagnostic.status, message: "CapDent AI connection test failed." }, 502);
    }
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!authorization || !supabaseUrl || !supabaseAnonKey) return json({ error: "Authenticated CapDent session required." }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "Authenticated CapDent session required." }, 401);

  if (body.action === "patient_dental_chart") {
    if (!isUuid(body.patient_id)) return json({ error: "A valid patient is required for this dental-chart AI summary." }, 400);
    const question = cleanQuestion(body.question) || "Summarize this patient's recorded dental chart.";
    const { data: chartRows, error: chartError } = await supabase.rpc("get_capdent_ai_patient_dental_chart", { p_patient_id: body.patient_id });
    if (chartError) {
      const message = String(chartError.message || "");
      if (/clinical ai access|role/i.test(message)) return json({ error: "Dental-chart AI is available only to doctors and clinic owners." }, 403);
      if (/patient not available|current clinic/i.test(message)) return json({ error: "Patient is not available in your clinic." }, 404);
      return json({ error: "Unable to load this patient's AI-safe dental chart." }, 500);
    }
    const chartContext = Array.isArray(chartRows) ? chartRows[0] : null;
    if (!chartContext) return json({ error: "No dental-chart context is available for this patient." }, 404);
    try {
      const result = await callAi(providers, {
        system: "You are CapDent AI. Summarize only the supplied structured dental-chart records. Do not diagnose, infer disease, recommend treatment, prescribe, or claim to have examined the patient. Use plain text only, no Markdown table, no headings, no asterisks or pipe characters. Give one short summary followed by at most four concise bullet lines using • when useful.",
        user: `Question: ${question}\n\nVerified CapDent dental-chart records:\n${JSON.stringify(chartContext)}`,
        maxOutputTokens: 220,
      });
      return json({ connected: true, provider: result.provider, model: result.model, action: "patient_dental_chart", question, answer: result.text || "No dental-chart summary could be generated.", context: chartContext, privacy: "structured_dental_chart_only", read_only: true });
    } catch {
      return json({ error: "CapDent AI could not generate the dental-chart summary." }, 502);
    }
  }

  if (body.action === "patient_history") {
    if (!isUuid(body.patient_id)) return json({ error: "A valid patient is required for this AI summary." }, 400);
    const question = cleanQuestion(body.question) || "Summarize this patient's recorded visit and treatment history.";
    const { data: patientContext, error: patientError } = await supabase.rpc("get_capdent_ai_patient_history", { p_patient_id: body.patient_id });
    if (patientError) {
      const message = String(patientError.message || "");
      if (/doctor access/i.test(message)) return json({ error: "Clinical AI summary is available only to doctors and clinic owners." }, 403);
      if (/not found/i.test(message)) return json({ error: "Patient is not available in your clinic." }, 404);
      return json({ error: "Unable to load this patient's AI-safe visit history." }, 500);
    }
    try {
      const result = await callAi(providers, {
        system: "You are CapDent AI. Summarize only the supplied visit and treatment records. Do not create a new diagnosis, invent findings, recommend treatment, prescribe, or claim to have examined the patient. Use plain text only, no Markdown table, no headings, no asterisks or pipe characters. Give one short summary followed by at most four concise bullet lines using • when useful.",
        user: `Question: ${question}\n\nVerified CapDent visit timeline:\n${JSON.stringify(patientContext)}`,
        maxOutputTokens: 220,
      });
      return json({ connected: true, provider: result.provider, model: result.model, action: "patient_history", question, answer: result.text || "No visit-history summary could be generated.", context: patientContext, privacy: "minimal_clinical_timeline", read_only: true });
    } catch {
      return json({ error: "CapDent AI could not generate the patient visit-history summary." }, 502);
    }
  }

  const question = cleanQuestion(body.question) || "How is my clinic doing today?";
  const period: AnalyticsPeriod = body.action === "today_summary" ? "daily" : resolvePeriod(question, body.period);
  const rpcResult = period === "daily" ? await supabase.rpc("get_capdent_ai_today_summary") : await supabase.rpc("get_capdent_ai_period_analytics", { p_period: period });
  if (rpcResult.error) {
    console.error("CapDent AI analytics RPC failed", period, rpcResult.error);
    return json({ error: "Unable to load the requested clinic analytics." }, 500);
  }
  const summary = Array.isArray(rpcResult.data) ? rpcResult.data[0] : null;
  if (!summary) return json({ error: "No active clinic analytics are available for this account." }, 404);

  const facts = analyticsFacts(period, question, summary as Record<string, unknown>);
  try {
    const result = await callAi(providers, {
      system: [
        "You are CapDent AI, a clinic dashboard assistant.",
        "Answer only from the verified facts supplied by CapDent; do not recalculate dates, percentages, averages or money yourself.",
        "The supplied comparison windows are intentionally matched for fairness. Never replace them with full calendar-month or full-week denominators.",
        "Answer the user's exact question first and ignore unrelated metrics unless they materially help.",
        "Use plain text only. Never use Markdown tables, headings, asterisks, code blocks or pipe characters.",
        "Keep the response compact: usually one direct sentence plus at most four short bullet lines using •.",
        "Do not expose finance when the facts do not contain finance. Outstanding dues are a current lifetime balance.",
        "Do not invent clinic facts, patient identities or clinical conclusions. Do not claim to modify records.",
      ].join(" "),
      user: `User question: ${question}\n\nVerified CapDent facts:\n${facts}`,
      maxOutputTokens: 180,
    });
    return json({ connected: true, provider: result.provider, provider_status: "ok", model: result.model, action: "analytics", period, question, answer: result.text || analyticsFallback(period, question, summary as Record<string, unknown>), summary, privacy: "aggregate_only", read_only: true, fallback: false });
  } catch (error) {
    const diagnostic = providerStatus(error);
    console.error("CapDent AI analytics generation degraded", diagnostic);
    return json({ connected: false, provider: diagnostic.provider, provider_status: diagnostic.status, provider_code: diagnostic.code, model: diagnostic.model, action: "analytics", period, question, answer: analyticsFallback(period, question, summary as Record<string, unknown>), summary, privacy: "aggregate_only", read_only: true, fallback: true });
  }
});
