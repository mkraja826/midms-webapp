import { supabase } from "@/lib/supabase";

export type CapDentAiPingResult = {
  connected: boolean;
  provider: "xai";
  model?: string;
  message: string;
  code?: string;
};

export type CapDentAiTodaySummary = {
  clinic_name: string;
  currency_code: string;
  local_date: string;
  patients_today: number;
  new_patients_today: number;
  appointments_today: number;
  waiting_count: number;
  completed_count: number;
  visits_today: number;
  gallery_uploads_today: number;
  net_collections_today: number | string;
  outstanding_dues: number | string;
};

export type CapDentAiTodayResult = {
  connected: boolean;
  provider: "xai";
  model: string;
  action: "today_summary";
  answer: string;
  summary: CapDentAiTodaySummary;
  privacy: "aggregate_only";
  read_only: true;
};

async function invokeCapDentAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("capdent-ai", { body });

  if (error) {
    const context = typeof error === "object" && error && "context" in error
      ? (error as { context?: unknown }).context
      : null;

    if (context instanceof Response) {
      const payload = await context.json().catch(() => null) as { message?: string; error?: string } | null;
      if (payload?.message || payload?.error) {
        throw new Error(payload.message || payload.error);
      }
    }

    throw error;
  }

  if (!data) throw new Error("CapDent AI returned no response.");
  return data;
}

export async function testCapDentAiConnection(): Promise<CapDentAiPingResult> {
  return invokeCapDentAi<CapDentAiPingResult>({ action: "ping" });
}

export async function getCapDentAiTodaySummary(): Promise<CapDentAiTodayResult> {
  return invokeCapDentAi<CapDentAiTodayResult>({ action: "today_summary" });
}
