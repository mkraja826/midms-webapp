import { supabase } from "@/lib/supabase";

export type CapDentAiAgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CapDentAiAgentResult = {
  connected: true;
  provider: "groq";
  model: string;
  answer: string;
  used_tools: string[];
  read_only: true;
  clinic_scoped: true;
  role: string;
  tool_round_limit_reached?: boolean;
};

export async function askCapDentAiReadOnly(
  message: string,
  history: CapDentAiAgentMessage[] = []
): Promise<CapDentAiAgentResult> {
  const cleaned = message.trim().slice(0, 1600);
  if (!cleaned) throw new Error("Ask CapDent AI a question.");

  const safeHistory = history
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, 1400) }))
    .filter((item) => item.content)
    .slice(-10);

  const { data, error } = await supabase.functions.invoke<CapDentAiAgentResult>("capdent-ai-agent", {
    body: { message: cleaned, history: safeHistory },
  });

  if (error) {
    const context = typeof error === "object" && error && "context" in error
      ? (error as { context?: unknown }).context
      : null;

    if (context instanceof Response) {
      const payload = await context.json().catch(() => null) as { error?: string; message?: string } | null;
      if (payload?.error || payload?.message) throw new Error(payload.error || payload.message);
    }
    throw error;
  }

  if (!data) throw new Error("CapDent AI returned no response.");
  return data;
}
