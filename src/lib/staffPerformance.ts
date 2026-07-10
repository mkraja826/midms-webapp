import { getCurrentProfile, supabase } from "@/lib/supabase";

export type StaffPerformanceRangeKey = "today" | "week" | "month" | "all";

export type StaffPerformanceRow = {
  staffId: string;
  name: string;
  role: string;
  active: boolean;
  visits: number;
  revenue: number;
  payments: number;
  uploads: number;
  appointments: number;
  tablets: number;
  edits: number;
  score: number;
  lastActivityAt: string | null;
};

export type StaffPerformanceReport = {
  rangeLabel: string;
  generatedAt: string;
  rows: StaffPerformanceRow[];
  summary: {
    staff: number;
    activeStaff: number;
    visits: number;
    revenue: number;
    uploads: number;
    appointments: number;
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

export function getStaffPerformanceDateRange(key: StaffPerformanceRangeKey): DateRange {
  if (key === "all") return { start: null, end: null, label: "All activity" };

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

function applyDateRange<T>(query: T, column: string, range: DateRange): T {
  if (!range.start || !range.end) return query;
  return (query as any).gte(column, range.start).lte(column, range.end) as T;
}

function isMissingOptionalTable(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST106" ||
    message.includes("could not find the table") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

async function safeRows<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: any }>,
  options?: { optional?: boolean }
) {
  try {
    const { data, error } = await query;
    if (error) {
      if (!options?.optional || !isMissingOptionalTable(error)) {
        console.warn(`${label} staff performance query failed:`, error.message || error);
      }
      return [] as T[];
    }
    return (data || []) as T[];
  } catch (error) {
    if (!options?.optional || !isMissingOptionalTable(error)) {
      console.warn(`${label} staff performance query failed:`, error);
    }
    return [] as T[];
  }
}

function moneyNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roleLabel(role?: string | null) {
  if (role === "owner" || role === "head_doctor") return "Owner / Head Doctor";
  if (role === "working_doctor" || role === "doctor") return "Doctor";
  if (role === "receptionist") return "Receptionist";
  return role || "Staff";
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

function newerDate(current: string | null, next?: string | null) {
  if (!next) return current;
  if (!current) return next;
  return new Date(next).getTime() > new Date(current).getTime() ? next : current;
}

function createEmptyRow(staff: any): StaffPerformanceRow {
  return {
    staffId: staff.id,
    name: staff.name || staff.email || "Staff",
    role: roleLabel(staff.role),
    active: staff.active !== false,
    visits: 0,
    revenue: 0,
    payments: 0,
    uploads: 0,
    appointments: 0,
    tablets: 0,
    edits: 0,
    score: 0,
    lastActivityAt: null,
  };
}

export async function buildStaffPerformanceReport(
  rangeKey: StaffPerformanceRangeKey
): Promise<StaffPerformanceReport> {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const range = getStaffPerformanceDateRange(rangeKey);
  const limit = rangeKey === "all" ? 3000 : 1000;

  const [staffRows, patientRows] = await Promise.all([
    safeRows<any>(
      "Staff list",
      supabase
        .from("profiles")
        .select("id,name,email,role,active,created_at")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false })
    ),
    safeRows<any>(
      "Staff performance patient map",
      supabase
        .from("patients")
        .select("id")
        .eq("clinic_id", profile.clinic_id)
        .limit(5000)
    ),
  ]);

  const clinicPatientIds = new Set(patientRows.map((row) => row.id).filter(Boolean));
  const staffMap = new Map<string, StaffPerformanceRow>();

  staffRows.forEach((staff) => {
    if (staff?.id) staffMap.set(staff.id, createEmptyRow(staff));
  });

  const ensureStaff = (staffId?: string | null) => {
    if (!staffId || !staffMap.has(staffId)) return null;
    return staffMap.get(staffId) || null;
  };

  const visitQuery = applyDateRange(
    supabase
      .from("patient_visits")
      .select("patient_id,doctor_id,created_at,visit_date")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const paymentQuery = applyDateRange(
    supabase
      .from("payments")
      .select("patient_id,amount,collected_by,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const fileQuery = applyDateRange(
    supabase
      .from("files")
      .select("patient_id,uploaded_by,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const appointmentQuery = applyDateRange(
    supabase
      .from("appointments")
      .select("patient_id,doctor_id,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const medicationQuery = applyDateRange(
    supabase
      .from("patient_medications")
      .select("patient_id,prescribed_by,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const auditQuery = applyDateRange(
    supabase
      .from("patient_audit_logs")
      .select("patient_id,changed_by,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const [visits, payments, files, appointments, medications, audits] = await Promise.all([
    safeRows<any>("Staff visits", visitQuery),
    safeRows<any>("Staff payments", paymentQuery),
    safeRows<any>("Staff uploads", fileQuery),
    safeRows<any>("Staff appointments", appointmentQuery),
    safeRows<any>("Staff tablets", medicationQuery, { optional: true }),
    safeRows<any>("Staff edits", auditQuery, { optional: true }),
  ]);

  visits
    .filter((row) => clinicPatientIds.has(row.patient_id))
    .forEach((row) => {
      const staff = ensureStaff(row.doctor_id);
      if (!staff) return;
      staff.visits += 1;
      staff.lastActivityAt = newerDate(staff.lastActivityAt, row.created_at || row.visit_date);
    });

  payments
    .filter((row) => clinicPatientIds.has(row.patient_id))
    .forEach((row) => {
      const staff = ensureStaff(row.collected_by);
      if (!staff) return;
      staff.payments += 1;
      staff.revenue += moneyNumber(row.amount);
      staff.lastActivityAt = newerDate(staff.lastActivityAt, row.created_at);
    });

  files
    .filter((row) => clinicPatientIds.has(row.patient_id))
    .forEach((row) => {
      const staff = ensureStaff(row.uploaded_by);
      if (!staff) return;
      staff.uploads += 1;
      staff.lastActivityAt = newerDate(staff.lastActivityAt, row.created_at);
    });

  appointments
    .filter((row) => clinicPatientIds.has(row.patient_id))
    .forEach((row) => {
      const staff = ensureStaff(row.doctor_id);
      if (!staff) return;
      staff.appointments += 1;
      staff.lastActivityAt = newerDate(staff.lastActivityAt, row.created_at);
    });

  medications
    .filter((row) => clinicPatientIds.has(row.patient_id))
    .forEach((row) => {
      const staff = ensureStaff(row.prescribed_by);
      if (!staff) return;
      staff.tablets += 1;
      staff.lastActivityAt = newerDate(staff.lastActivityAt, row.created_at);
    });

  audits
    .filter((row) => clinicPatientIds.has(row.patient_id))
    .forEach((row) => {
      const staff = ensureStaff(row.changed_by);
      if (!staff) return;
      staff.edits += 1;
      staff.lastActivityAt = newerDate(staff.lastActivityAt, row.created_at);
    });

  const rows = Array.from(staffMap.values())
    .map((row) => ({
      ...row,
      score:
        row.visits * 5 +
        row.payments * 4 +
        row.uploads * 3 +
        row.appointments * 2 +
        row.tablets * 2 +
        row.edits,
      lastActivityAt: row.lastActivityAt ? dateText(row.lastActivityAt) : null,
    }))
    .sort((a, b) => b.score - a.score || b.revenue - a.revenue || a.name.localeCompare(b.name));

  return {
    rangeLabel: range.label,
    generatedAt: dateText(new Date().toISOString()),
    rows,
    summary: {
      staff: rows.length,
      activeStaff: rows.filter((row) => row.active).length,
      visits: rows.reduce((sum, row) => sum + row.visits, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      uploads: rows.reduce((sum, row) => sum + row.uploads, 0),
      appointments: rows.reduce((sum, row) => sum + row.appointments, 0),
    },
  };
}
