import { getCurrentProfile, supabase } from "@/lib/supabase";

export type TreatmentReviewRangeKey = "today" | "week" | "month" | "all";

export type TreatmentReviewItem = {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientCode: string;
  treatmentName: string;
  description: string;
  cost: number;
  status: string;
  doctorName: string;
  createdAt: string;
  pendingDue: number;
};

export type TreatmentReviewReport = {
  rangeLabel: string;
  generatedAt: string;
  items: TreatmentReviewItem[];
  summary: {
    totalTreatments: number;
    planned: number;
    ongoing: number;
    completed: number;
    cancelled: number;
    totalValue: number;
    openValue: number;
    completedValue: number;
    patientPendingDue: number;
  };
};

type DateRange = {
  start: string | null;
  end: string | null;
  label: string;
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function getDateRange(key: TreatmentReviewRangeKey): DateRange {
  if (key === "all") return { start: null, end: null, label: "All treatments" };

  const start = startOfToday();
  const end = endOfToday();

  if (key === "week") start.setDate(start.getDate() - 6);
  if (key === "month") start.setDate(1);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: key === "today" ? "Today" : key === "week" ? "Last 7 days" : "This month",
  };
}

function applyDateRange<T>(query: T, range: DateRange): T {
  if (!range.start || !range.end) return query;
  return (query as any).gte("created_at", range.start).lte("created_at", range.end) as T;
}

async function safeRows<T>(label: string, query: PromiseLike<{ data: T[] | null; error: any }>) {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn(`${label} treatment review query failed:`, error.message || error);
      return [] as T[];
    }

    return (data || []) as T[];
  } catch (error) {
    console.warn(`${label} treatment review query failed:`, error);
    return [] as T[];
  }
}

function moneyNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function dateText(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function patientCode(row?: { patient_code?: string | null }) {
  return row?.patient_code || "No patient code";
}

function patientPhone(row?: { phone?: string | null }) {
  return row?.phone || "No phone";
}

function normalizeStatus(status?: string | null) {
  const clean = String(status || "planned").toLowerCase();
  if (clean === "ongoing" || clean === "completed" || clean === "cancelled" || clean === "planned") return clean;
  return "planned";
}

export async function buildTreatmentReviewReport(rangeKey: TreatmentReviewRangeKey): Promise<TreatmentReviewReport> {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const range = getDateRange(rangeKey);
  const limit = rangeKey === "all" ? 300 : 150;

  const [patients, staff, visits] = await Promise.all([
    safeRows<any>(
      "Patients map",
      supabase
        .from("patients")
        .select("id,name,phone,patient_code")
        .eq("clinic_id", profile.clinic_id)
        .limit(5000)
    ),
    safeRows<any>(
      "Staff map",
      supabase
        .from("profiles")
        .select("id,name,role")
        .eq("clinic_id", profile.clinic_id)
        .limit(500)
    ),
    safeRows<any>(
      "Visit map",
      supabase
        .from("patient_visits")
        .select("id,patient_id,doctor_id")
        .eq("clinic_id", profile.clinic_id)
        .limit(5000)
    ),
  ]);

  const patientMap = new Map<string, any>(patients.map((row) => [row.id, row]));
  const staffMap = new Map<string, any>(staff.map((row) => [row.id, row]));
  const visitMap = new Map<string, any>(visits.map((row) => [row.id, row]));

  const treatmentQuery = applyDateRange(
    supabase
      .from("treatments")
      .select("id,patient_id,visit_id,treatment_name,description,cost,status,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    range
  );

  const invoiceRows = await safeRows<any>(
    "Pending invoices",
    supabase
      .from("invoices")
      .select("patient_id,due_amount,status")
      .eq("clinic_id", profile.clinic_id)
      .gt("due_amount", 0)
      .in("status", ["unpaid", "partial"])
      .limit(5000)
  );

  const patientDueMap = new Map<string, number>();
  invoiceRows.forEach((row) => {
    if (!patientMap.has(row.patient_id)) return;
    patientDueMap.set(row.patient_id, (patientDueMap.get(row.patient_id) || 0) + moneyNumber(row.due_amount));
  });

  const treatmentRows = await safeRows<any>("Treatments", treatmentQuery);

  const items = treatmentRows
    .filter((row) => patientMap.has(row.patient_id))
    .map((row) => {
      const patient = patientMap.get(row.patient_id);
      const visit = visitMap.get(row.visit_id);
      const doctor = staffMap.get(visit?.doctor_id);

      return {
        id: row.id,
        patientId: row.patient_id,
        patientName: patient?.name || "Patient",
        patientPhone: patientPhone(patient),
        patientCode: patientCode(patient),
        treatmentName: row.treatment_name || "Treatment",
        description: row.description || "",
        cost: moneyNumber(row.cost),
        status: normalizeStatus(row.status),
        doctorName: doctor?.name || "Doctor not linked",
        createdAt: row.created_at,
        pendingDue: patientDueMap.get(row.patient_id) || 0,
      } satisfies TreatmentReviewItem;
    });

  const totalValue = items.reduce((sum, item) => sum + item.cost, 0);
  const openValue = items
    .filter((item) => item.status === "planned" || item.status === "ongoing")
    .reduce((sum, item) => sum + item.cost, 0);
  const completedValue = items
    .filter((item) => item.status === "completed")
    .reduce((sum, item) => sum + item.cost, 0);
  const patientPendingDue = Array.from(new Set(items.map((item) => item.patientId))).reduce(
    (sum, patientId) => sum + (patientDueMap.get(patientId) || 0),
    0
  );

  return {
    rangeLabel: range.label,
    generatedAt: dateText(new Date().toISOString()),
    items,
    summary: {
      totalTreatments: items.length,
      planned: items.filter((item) => item.status === "planned").length,
      ongoing: items.filter((item) => item.status === "ongoing").length,
      completed: items.filter((item) => item.status === "completed").length,
      cancelled: items.filter((item) => item.status === "cancelled").length,
      totalValue,
      openValue,
      completedValue,
      patientPendingDue,
    },
  };
}
