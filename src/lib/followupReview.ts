import { getCurrentProfile, supabase } from "@/lib/supabase";

export type FollowupRangeKey = "today" | "tomorrow" | "week" | "overdue" | "all";

export type FollowupReviewSource = "followup" | "appointment";

export type FollowupReviewItem = {
  id: string;
  source: FollowupReviewSource;
  title: string;
  subtitle: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  patientCode: string | null;
  staffName: string;
  dueAt: string;
  status: "overdue" | "today" | "upcoming";
  tone: "primary" | "success" | "warning" | "danger";
};

export type FollowupReviewReport = {
  rangeLabel: string;
  generatedAt: string;
  items: FollowupReviewItem[];
  summary: {
    total: number;
    overdue: number;
    today: number;
    week: number;
    followups: number;
    appointments: number;
  };
};

type DateRange = {
  start: string | null;
  end: string | null;
  label: string;
  mode: "normal" | "overdue" | "all";
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getFollowupDateRange(key: FollowupRangeKey): DateRange {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  if (key === "all") return { start: null, end: null, label: "All open follow-ups", mode: "all" };

  if (key === "overdue") {
    const overdueEnd = new Date(todayStart);
    overdueEnd.setMilliseconds(-1);
    return {
      start: null,
      end: overdueEnd.toISOString(),
      label: "Overdue",
      mode: "overdue",
    };
  }

  if (key === "tomorrow") {
    const start = addDays(todayStart, 1);
    const end = addDays(todayEnd, 1);
    return { start: start.toISOString(), end: end.toISOString(), label: "Tomorrow", mode: "normal" };
  }

  if (key === "week") {
    return {
      start: todayStart.toISOString(),
      end: addDays(todayEnd, 6).toISOString(),
      label: "Next 7 days",
      mode: "normal",
    };
  }

  return { start: todayStart.toISOString(), end: todayEnd.toISOString(), label: "Today", mode: "normal" };
}

function applyDueRange<T>(query: T, column: string, range: DateRange): T {
  if (range.mode === "all") return query;
  if (range.mode === "overdue") return (query as any).lt(column, startOfToday().toISOString()) as T;
  if (!range.start || !range.end) return query;
  return (query as any).gte(column, range.start).lte(column, range.end) as T;
}

async function safeRows<T>(label: string, query: PromiseLike<{ data: T[] | null; error: any }>) {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn(`${label} follow-up query failed:`, error.message || error);
      return [] as T[];
    }
    return (data || []) as T[];
  } catch (error) {
    console.warn(`${label} follow-up query failed:`, error);
    return [] as T[];
  }
}

function dateText(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dueStatus(value: string): FollowupReviewItem["status"] {
  const due = new Date(value);
  const start = startOfToday();
  const end = endOfToday();

  if (Number.isNaN(due.getTime())) return "upcoming";
  if (due.getTime() < start.getTime()) return "overdue";
  if (due.getTime() <= end.getTime()) return "today";
  return "upcoming";
}

function toneForStatus(status: FollowupReviewItem["status"]): FollowupReviewItem["tone"] {
  if (status === "overdue") return "danger";
  if (status === "today") return "warning";
  return "primary";
}

function statusLabel(status: FollowupReviewItem["status"]) {
  if (status === "overdue") return "Overdue";
  if (status === "today") return "Today";
  return "Upcoming";
}

function roleLabel(role?: string | null) {
  if (role === "owner" || role === "head_doctor") return "Owner / Head Doctor";
  if (role === "working_doctor" || role === "doctor") return "Doctor";
  if (role === "receptionist") return "Receptionist";
  return role || "Staff";
}

function patientName(row?: { name?: string | null }) {
  return row?.name || "Patient";
}

function staffName(row?: { name?: string | null; role?: string | null }) {
  if (!row) return "Clinic staff";
  return `${row.name || "Staff"}${row.role ? ` - ${roleLabel(row.role)}` : ""}`;
}

function itemId(prefix: string, value: string, index: number) {
  return `${prefix}-${value}-${index}`;
}

export function buildFollowupWhatsAppMessage(item: FollowupReviewItem) {
  const due = dateText(item.dueAt);
  const typeText = item.source === "appointment" ? "appointment" : "follow-up";
  return `Hello ${item.patientName}, this is a reminder from your dental clinic for your ${typeText} on ${due}. Please confirm your visit.`;
}

export async function buildFollowupReview(rangeKey: FollowupRangeKey): Promise<FollowupReviewReport> {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const range = getFollowupDateRange(rangeKey);
  const limit = rangeKey === "all" ? 500 : 250;

  const [patientsAll, staffAll] = await Promise.all([
    safeRows<any>(
      "Follow-up patients map",
      supabase
        .from("patients")
        .select("id,patient_code,name,phone")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false })
        .limit(3000)
    ),
    safeRows<any>(
      "Follow-up staff map",
      supabase
        .from("profiles")
        .select("id,name,role")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false })
    ),
  ]);

  const patientMap = new Map<string, any>(patientsAll.map((row) => [row.id, row]));
  const staffMap = new Map<string, any>(staffAll.map((row) => [row.id, row]));

  const visitsQuery = applyDueRange(
    supabase
      .from("patient_visits")
      .select("id,patient_id,doctor_id,chief_complaint,doctor_notes,next_appointment_date,visit_date,created_at")
      .eq("clinic_id", profile.clinic_id)
      .not("next_appointment_date", "is", null)
      .order("next_appointment_date", { ascending: true })
      .limit(limit),
    "next_appointment_date",
    range
  );

  const appointmentsQuery = applyDueRange(
    supabase
      .from("appointments")
      .select("id,patient_id,doctor_id,appointment_time,status,notes,created_at")
      .eq("clinic_id", profile.clinic_id)
      .neq("status", "completed")
      .order("appointment_time", { ascending: true })
      .limit(limit),
    "appointment_time",
    range
  );

  const [visits, appointments] = await Promise.all([
    safeRows<any>("Follow-up visits", visitsQuery),
    safeRows<any>("Follow-up appointments", appointmentsQuery),
  ]);

  const followupItems: FollowupReviewItem[] = visits
    .filter((row) => row.patient_id && patientMap.has(row.patient_id) && row.next_appointment_date)
    .map((row, index) => {
      const patient = patientMap.get(row.patient_id);
      const status = dueStatus(row.next_appointment_date);
      return {
        id: itemId("followup", row.id || row.next_appointment_date, index),
        source: "followup" as const,
        title: `${statusLabel(status)} follow-up`,
        subtitle: `${dateText(row.next_appointment_date)} • ${row.chief_complaint || "Follow-up from visit"}`,
        patientId: row.patient_id,
        patientName: patientName(patient),
        patientPhone: patient?.phone || null,
        patientCode: patient?.patient_code || null,
        staffName: staffName(staffMap.get(row.doctor_id)),
        dueAt: row.next_appointment_date,
        status,
        tone: toneForStatus(status),
      };
    });

  const appointmentItems: FollowupReviewItem[] = appointments
    .filter((row) => row.patient_id && patientMap.has(row.patient_id) && row.appointment_time)
    .map((row, index) => {
      const patient = patientMap.get(row.patient_id);
      const status = dueStatus(row.appointment_time);
      return {
        id: itemId("appointment", row.id || row.appointment_time, index),
        source: "appointment" as const,
        title: `${statusLabel(status)} appointment`,
        subtitle: `${dateText(row.appointment_time)} • ${row.status || "scheduled"}${row.notes ? ` • ${row.notes}` : ""}`,
        patientId: row.patient_id,
        patientName: patientName(patient),
        patientPhone: patient?.phone || null,
        patientCode: patient?.patient_code || null,
        staffName: staffName(staffMap.get(row.doctor_id)),
        dueAt: row.appointment_time,
        status,
        tone: toneForStatus(status),
      };
    });

  const items = [...followupItems, ...appointmentItems]
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 300);

  return {
    rangeLabel: range.label,
    generatedAt: dateText(new Date().toISOString()),
    items,
    summary: {
      total: items.length,
      overdue: items.filter((item) => item.status === "overdue").length,
      today: items.filter((item) => item.status === "today").length,
      week: items.filter((item) => item.status !== "overdue").length,
      followups: followupItems.length,
      appointments: appointmentItems.length,
    },
  };
}
