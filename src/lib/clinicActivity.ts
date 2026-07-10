import { getCurrentProfile, supabase } from "@/lib/supabase";

export type ActivityRangeKey = "today" | "week" | "month" | "all";

export type ClinicActivityKind =
  | "patient"
  | "visit"
  | "payment"
  | "file"
  | "appointment"
  | "tablet"
  | "edit"
  | "staff";

export type ClinicActivityItem = {
  id: string;
  kind: ClinicActivityKind;
  title: string;
  subtitle: string;
  patient?: string;
  staff?: string;
  amount?: number | null;
  createdAt: string;
  tone: "primary" | "success" | "warning" | "danger";
};

export type ClinicActivityReport = {
  rangeLabel: string;
  generatedAt: string;
  items: ClinicActivityItem[];
  summary: {
    total: number;
    payments: number;
    visits: number;
    uploads: number;
    edits: number;
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

export function getActivityDateRange(key: ActivityRangeKey): DateRange {
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
        console.warn(`${label} activity query failed:`, error.message || error);
      }
      return [] as T[];
    }
    return (data || []) as T[];
  } catch (error) {
    if (!options?.optional || !isMissingOptionalTable(error)) {
      console.warn(`${label} activity query failed:`, error);
    }
    return [] as T[];
  }
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

function roleLabel(role?: string | null) {
  if (role === "owner" || role === "head_doctor") return "Owner / Head Doctor";
  if (role === "working_doctor" || role === "doctor") return "Doctor";
  if (role === "receptionist") return "Receptionist";
  return role || "Staff";
}

function patientLabel(row?: { patient_code?: string | null; name?: string | null; phone?: string | null }) {
  if (!row) return "Unknown patient";
  const code = row.patient_code ? `${row.patient_code} - ` : "";
  const phone = row.phone ? ` (${row.phone})` : "";
  return `${code}${row.name || "Patient"}${phone}`;
}

function staffLabel(row?: { name?: string | null; role?: string | null }) {
  if (!row) return "Unknown staff";
  return `${row.name || "Staff"}${row.role ? ` - ${roleLabel(row.role)}` : ""}`;
}

function paymentCategoryLabel(value?: string | null) {
  if (value === "op_fee") return "OP fee";
  if (value === "xray_fee") return "X-ray fee";
  if (value === "medication_fee") return "Medication fee";
  if (value === "treatment_fee") return "Treatment fee";
  if (value === "pending_collection") return "Pending collection";
  return value || "Payment";
}

function moneyNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function eventId(prefix: string, createdAt: string, index: number) {
  return `${prefix}-${createdAt}-${index}`;
}

export async function buildClinicActivityReport(rangeKey: ActivityRangeKey): Promise<ClinicActivityReport> {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const range = getActivityDateRange(rangeKey);
  const limit = rangeKey === "all" ? 120 : 60;

  const [patientsAll, staffAll] = await Promise.all([
    safeRows<any>(
      "Activity patients map",
      supabase
        .from("patients")
        .select("id,patient_code,name,phone")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false })
        .limit(3000)
    ),
    safeRows<any>(
      "Activity staff map",
      supabase
        .from("profiles")
        .select("id,name,role,email,active,created_at")
        .eq("clinic_id", profile.clinic_id)
        .order("created_at", { ascending: false })
    ),
  ]);

  const patientMap = new Map<string, any>(patientsAll.map((row) => [row.id, row]));
  const staffMap = new Map<string, any>(staffAll.map((row) => [row.id, row]));

  const patientQuery = applyDateRange(
    supabase
      .from("patients")
      .select("id,patient_code,name,phone,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const visitQuery = applyDateRange(
    supabase
      .from("patient_visits")
      .select("patient_id,doctor_id,chief_complaint,doctor_notes,visit_date,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const paymentQuery = applyDateRange(
    supabase
      .from("payments")
      .select("patient_id,amount,payment_method,payment_category,collected_by,notes,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const fileQuery = applyDateRange(
    supabase
      .from("files")
      .select("patient_id,file_type,file_name,uploaded_by,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const appointmentQuery = applyDateRange(
    supabase
      .from("appointments")
      .select("patient_id,doctor_id,appointment_time,status,notes,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const medicationQuery = applyDateRange(
    supabase
      .from("patient_medications")
      .select("patient_id,medication_name,dosage,frequency,duration,prescribed_by,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const auditQuery = applyDateRange(
    supabase
      .from("patient_audit_logs")
      .select("patient_id,changed_by,field_name,old_value,new_value,reason,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const staffQuery = applyDateRange(
    supabase
      .from("profiles")
      .select("id,name,role,email,active,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const [patients, visits, payments, files, appointments, medications, audits, staff] = await Promise.all([
    safeRows<any>("Patients", patientQuery),
    safeRows<any>("Visits", visitQuery),
    safeRows<any>("Payments", paymentQuery),
    safeRows<any>("Files", fileQuery),
    safeRows<any>("Appointments", appointmentQuery),
    safeRows<any>("Prescribed tablets", medicationQuery, { optional: true }),
    safeRows<any>("Patient edits", auditQuery, { optional: true }),
    safeRows<any>("Staff", staffQuery),
  ]);

  const items: ClinicActivityItem[] = [
    ...patients.map((row, index) => ({
      id: eventId("patient", row.created_at, index),
      kind: "patient" as const,
      title: "Patient registered",
      subtitle: `${patientLabel(row)} was added to clinic records.`,
      patient: patientLabel(row),
      createdAt: row.created_at,
      tone: "primary" as const,
    })),
    ...visits.map((row, index) => ({
      id: eventId("visit", row.created_at || row.visit_date, index),
      kind: "visit" as const,
      title: "Visit completed",
      subtitle: `${patientLabel(patientMap.get(row.patient_id))} • ${row.chief_complaint || "Visit notes added"}`,
      patient: patientLabel(patientMap.get(row.patient_id)),
      staff: staffLabel(staffMap.get(row.doctor_id)),
      createdAt: row.created_at || row.visit_date,
      tone: "success" as const,
    })),
    ...payments.map((row, index) => ({
      id: eventId("payment", row.created_at, index),
      kind: "payment" as const,
      title: `${paymentCategoryLabel(row.payment_category)} collected`,
      subtitle: `₹${Math.round(moneyNumber(row.amount)).toLocaleString("en-IN")} • ${row.payment_method || "Payment"} • ${patientLabel(patientMap.get(row.patient_id))}`,
      patient: patientLabel(patientMap.get(row.patient_id)),
      staff: staffLabel(staffMap.get(row.collected_by)),
      amount: moneyNumber(row.amount),
      createdAt: row.created_at,
      tone: "success" as const,
    })),
    ...files.map((row, index) => ({
      id: eventId("file", row.created_at, index),
      kind: "file" as const,
      title: "File uploaded",
      subtitle: `${row.file_type || "File"} • ${row.file_name || "Uploaded file"} • ${patientLabel(patientMap.get(row.patient_id))}`,
      patient: patientLabel(patientMap.get(row.patient_id)),
      staff: staffLabel(staffMap.get(row.uploaded_by)),
      createdAt: row.created_at,
      tone: "primary" as const,
    })),
    ...appointments.map((row, index) => ({
      id: eventId("appointment", row.created_at, index),
      kind: "appointment" as const,
      title: "Appointment booked",
      subtitle: `${patientLabel(patientMap.get(row.patient_id))} • ${dateText(row.appointment_time)} • ${row.status || "scheduled"}`,
      patient: patientLabel(patientMap.get(row.patient_id)),
      staff: staffLabel(staffMap.get(row.doctor_id)),
      createdAt: row.created_at,
      tone: "warning" as const,
    })),
    ...medications.map((row, index) => ({
      id: eventId("tablet", row.created_at, index),
      kind: "tablet" as const,
      title: "Prescribed tablet entered",
      subtitle: `${row.medication_name || "Tablet"}${row.dosage ? ` • ${row.dosage}` : ""}${row.duration ? ` • ${row.duration}` : ""}`,
      patient: patientLabel(patientMap.get(row.patient_id)),
      staff: staffLabel(staffMap.get(row.prescribed_by)),
      createdAt: row.created_at,
      tone: "primary" as const,
    })),
    ...audits.map((row, index) => ({
      id: eventId("edit", row.created_at, index),
      kind: "edit" as const,
      title: "Patient detail edited",
      subtitle: `${patientLabel(patientMap.get(row.patient_id))} • ${row.field_name || "field"} changed${row.reason ? ` • ${row.reason}` : ""}`,
      patient: patientLabel(patientMap.get(row.patient_id)),
      staff: staffLabel(staffMap.get(row.changed_by)),
      createdAt: row.created_at,
      tone: "warning" as const,
    })),
    ...staff.map((row, index) => ({
      id: eventId("staff", row.created_at, index),
      kind: "staff" as const,
      title: "Staff profile created",
      subtitle: `${row.name || "Staff"} • ${roleLabel(row.role)} • ${row.active ? "Active" : "Inactive"}`,
      staff: staffLabel(row),
      createdAt: row.created_at,
      tone: row.active ? ("primary" as const) : ("warning" as const),
    })),
  ]
    .filter((item) => Boolean(item.createdAt))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 200);

  return {
    rangeLabel: range.label,
    generatedAt: dateText(new Date().toISOString()),
    items,
    summary: {
      total: items.length,
      payments: payments.length,
      visits: visits.length,
      uploads: files.length,
      edits: audits.length,
    },
  };
}
