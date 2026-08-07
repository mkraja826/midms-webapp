import { supabase } from "@/lib/supabase";

export type CapDentAiPingResult = {
  connected: boolean;
  provider: "xai";
  model?: string;
  message: string;
  code?: string;
};

export async function testCapDentAiConnection(): Promise<CapDentAiPingResult> {
  const { data, error } = await supabase.functions.invoke<CapDentAiPingResult>("capdent-ai", {
    body: { action: "ping" },
  });

  if (error) {
    const context = typeof error === "object" && error && "context" in error
      ? (error as { context?: unknown }).context
      : null;

    if (context instanceof Response) {
      const payload = await context.json().catch(() => null) as Partial<CapDentAiPingResult> | null;
      if (payload?.message) {
        return {
          connected: Boolean(payload.connected),
          provider: "xai",
          model: payload.model,
          message: payload.message,
          code: payload.code,
        };
      }
    }

    throw error;
  }

  if (!data) throw new Error("CapDent AI returned no response.");
  return data;
}
