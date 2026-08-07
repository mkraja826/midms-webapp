import { supabase } from "@/lib/supabase";

export type CapDentAiPingResult = {
  connected: boolean;
  provider: "xai";
  model?: string;
  message: string;
  code?: string;
};

export type CapDentAiAnalyticsPeriod = "daily" | "tomorrow" | "weekly" | "monthly";

export type CapDentAiTodaySummary = {
  clinic_name: string;
  currency_code: string;
  local_date: string;
  user_role: string;
  can_view_finance: boolean;
  patients_today: number;
  new_patients_today: number;
  appointments_today: number;
  waiting_count: number;
  completed_count: number;
  visits_today: number;
  gallery_uploads_today: number;
  net_collections_today: number | string | null;
  outstanding_dues: number | string | null;
};

export type CapDentAiTodayResult = {
  connected: boolean;
  provider: "xai";
  model: string;
  action: "analytics" | "today_summary";
  period?: CapDentAiAnalyticsPeriod;
  question: string;
  answer: string;
  summary: CapDentAiTodaySummary;
  privacy: "aggregate_only";
  read_only: true;
};

export type CapDentAiAnalyticsResult = {
  connected: boolean;
  provider: "xai";
  model: string;
  action: "analytics";
  period: CapDentAiAnalyticsPeriod;
  question: string;
  answer: string;
  summary: Record<string, string | number | boolean | null>;
  privacy: "aggregate_only";
  read_only: true;
};

export type CapDentAiPatientVisit = {
  id: string;
  visit_date: string;
  chief_complaint: string;
  diagnosis: string;
  visit_status: string | null;
  next_appointment_date: string | null;
};

export type CapDentAiPatientTreatment = {
  visit_id: string | null;
  created_at: string;
  treatment_name: string;
  category: string;
  status: string;
};

export type CapDentAiPatientContext = {
  patient_id: string;
  user_role: string;
  visit_count_included: number;
  treatment_count_included: number;
  visits: CapDentAiPatientVisit[];
  treatments: CapDentAiPatientTreatment[];
  privacy: {
    identifiers_included: false;
    doctor_notes_included: false;
    medical_history_included: false;
    files_included: false;
    max_visits: number;
    max_treatments: number;
  };
};

export type CapDentAiPatientHistoryResult = {
  connected: boolean;
  provider: "xai";
  model: string;
  action: "patient_history";
  question: string;
  answer: string;
  context: CapDentAiPatientContext;
  privacy: "minimal_clinical_timeline";
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

export async function askCapDentAi(question: string): Promise<CapDentAiAnalyticsResult> {
  const cleaned = question.trim().slice(0, 300) || "How is my clinic doing today?";
  return invokeCapDentAi<CapDentAiAnalyticsResult>({ action: "analytics", question: cleaned });
}

export async function askCapDentAiToday(
  question = "How is my clinic doing today?"
): Promise<CapDentAiTodayResult> {
  const cleaned = question.trim().slice(0, 300) || "How is my clinic doing today?";
  return invokeCapDentAi<CapDentAiTodayResult>({ action: "today_summary", question: cleaned });
}

export async function askCapDentAiPatientHistory(
  patientId: string,
  question = "Summarize this patient's recorded visit and treatment history."
): Promise<CapDentAiPatientHistoryResult> {
  const cleanedPatientId = patientId.trim();
  if (!cleanedPatientId) throw new Error("A patient is required for the AI summary.");
  const cleanedQuestion = question.trim().slice(0, 300) || "Summarize this patient's recorded visit and treatment history.";
  return invokeCapDentAi<CapDentAiPatientHistoryResult>({
    action: "patient_history",
    patient_id: cleanedPatientId,
    question: cleanedQuestion,
  });
}

export async function getCapDentAiTodaySummary(): Promise<CapDentAiTodayResult> {
  return askCapDentAiToday();
}
