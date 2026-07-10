import { getCurrentProfile, Patient, supabase } from "@/lib/supabase";

export type PatientDirectoryDatePreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";
export type PatientDirectoryDateField = "registered" | "visit" | "appointment" | "followup" | "payment";

export type PatientDirectorySearchInput = {
  query?: string;
  dateField?: PatientDirectoryDateField;
  preset?: PatientDirectoryDatePreset;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export type PatientDirectoryPage = {
  patients: Patient[];
  total: number;
  page: number;
  pageSize: number;
};

function rangeForPreset(preset: Exclude<PatientDirectoryDatePreset, "all" | "custom">) {
  const start = new Date();
  const end = new Date();

  if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }

  if (preset === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  }

  if (preset === "month") {
    start.setDate(1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start: start.toISOString(), end: end.toISOString() };
}

function isoDateBoundary(value: string, endOfDay = false) {
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cleanSearchTerm(value: string) {
  return value.trim().replace(/[,%]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

export async function searchPatientsPage(input: PatientDirectorySearchInput): Promise<PatientDirectoryPage> {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const pageSize = Math.max(1, Math.min(Number(input.pageSize || 10), 50));
  const page = Math.max(1, Number(input.page || 1));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const term = cleanSearchTerm(input.query ?? "");
  const preset = input.preset ?? "all";
  const dateField = input.dateField ?? "registered";

  let start: string | null = null;
  let end: string | null = null;

  if (preset !== "all") {
    if (preset === "custom") {
      start = input.startDate ? isoDateBoundary(input.startDate) : null;
      end = input.endDate ? isoDateBoundary(input.endDate, true) : null;
    } else {
      const range = rangeForPreset(preset);
      start = range.start;
      end = range.end;
    }
  }

  let patientIds: string[] | null = null;

  if (start && end && dateField !== "registered") {
    const table =
      dateField === "visit" || dateField === "followup"
        ? "patient_visits"
        : dateField === "appointment"
          ? "appointments"
          : "payments";

    const column =
      dateField === "visit"
        ? "visit_date"
        : dateField === "followup"
          ? "next_appointment_date"
          : dateField === "appointment"
            ? "appointment_time"
            : "created_at";

    const { data, error } = await supabase
      .from(table)
      .select("patient_id")
      .eq("clinic_id", profile.clinic_id)
      .gte(column, start)
      .lte(column, end);

    if (error) throw error;

    patientIds = Array.from(
      new Set((data ?? []).map((row: { patient_id?: string | null }) => row.patient_id).filter(Boolean))
    ) as string[];

    if (!patientIds.length) {
      return { patients: [], total: 0, page, pageSize };
    }
  }

  let queryBuilder = supabase
    .from("patients")
    .select("*", { count: "exact" })
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (term) {
    queryBuilder = queryBuilder.or(
      `name.ilike.%${term}%,phone.ilike.%${term}%,patient_code.ilike.%${term}%`
    );
  }

  if (start && end && dateField === "registered") {
    queryBuilder = queryBuilder.gte("created_at", start).lte("created_at", end);
  }

  if (patientIds) {
    queryBuilder = queryBuilder.in("id", patientIds);
  }

  const { data, error, count } = await queryBuilder;

  if (error) throw error;

  return {
    patients: (data ?? []) as Patient[],
    total: count ?? 0,
    page,
    pageSize,
  };
}
