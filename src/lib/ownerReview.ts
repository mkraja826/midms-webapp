import { getCurrentProfile, supabase } from "@/lib/supabase";

export type OwnerReviewTone = "primary" | "success" | "warning" | "danger";

export type OwnerReviewCard = {
  key: string;
  title: string;
  count: number;
  subtitle: string;
  tone: OwnerReviewTone;
  route: string;
  action: string;
};

export type MissedFollowupReview = {
  id: string;
  source: "appointment" | "visit";
  patient_id: string;
  patient_name: string;
  patient_code: string | null;
  patient_phone: string | null;
  due_at: string;
  notes: string | null;
};

export type PaidActiveTreatmentReview = {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_code: string | null;
  patient_phone: string | null;
  treatment_name: string;
  status: string;
  cost: number;
  created_at: string;
};

export type WaivedOpFeeReview = {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_code: string | null;
  patient_phone: string | null;
  amount: number;
  reason: string | null;
  created_at: string;
  waived_by_name: string | null;
};

export type OwnerReviewReport = {
  cards: OwnerReviewCard[];
  missedFollowups: MissedFollowupReview[];
  paidActiveTreatments: PaidActiveTreatmentReview[];
  waivedOpFees: WaivedOpFeeReview[];
  patientEditsCount: number;
};

type PatientMini = {
  id: string;
  name: string | null;
  patient_code: string | null;
  phone: string | null;
};

type ProfileMini = {
  id: string;
  name: string | null;
};

function toNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function patientLabel(patient?: PatientMini | null) {
  return patient?.name || "Patient";
}

function indexById<T extends { id: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

export async function getOwnerReviewReport(): Promise<OwnerReviewReport> {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const clinicId = profile.clinic_id;
  const now = new Date().toISOString();
  const todayStart = startOfToday();

  const [appointmentsResult, visitsResult, treatmentsResult, invoicesResult, waivedResult, editsResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("id,patient_id,appointment_time,notes,status")
      .eq("clinic_id", clinicId)
      .lt("appointment_time", now)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .neq("status", "no_show")
      .order("appointment_time", { ascending: false })
      .limit(20),
    supabase
      .from("patient_visits")
      .select("id,patient_id,next_appointment_date,doctor_notes")
      .eq("clinic_id", clinicId)
      .not("next_appointment_date", "is", null)
      .lt("next_appointment_date", now)
      .order("next_appointment_date", { ascending: false })
      .limit(20),
    supabase
      .from("treatments")
      .select("id,patient_id,treatment_name,status,cost,created_at")
      .eq("clinic_id", clinicId)
      .in("status", ["planned", "ongoing"])
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("invoices")
      .select("patient_id,due_amount,payment_category,status")
      .eq("clinic_id", clinicId)
      .eq("payment_category", "treatment_fee")
      .gt("due_amount", 0)
      .in("status", ["unpaid", "partial"]),
    supabase
      .from("appointments")
      .select("id,patient_id,op_fee_amount,op_fee_waiver_reason,op_fee_waived_by,created_at")
      .eq("clinic_id", clinicId)
      .eq("op_fee_status", "waived")
      .gte("created_at", todayStart)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("patient_audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("created_at", todayStart),
  ]);

  if (appointmentsResult.error) throw appointmentsResult.error;
  if (visitsResult.error) throw visitsResult.error;
  if (treatmentsResult.error) throw treatmentsResult.error;
  if (invoicesResult.error) throw invoicesResult.error;
  if (waivedResult.error) throw waivedResult.error;
  if (editsResult.error) throw editsResult.error;

  const appointmentRows = appointmentsResult.data || [];
  const visitRows = visitsResult.data || [];
  const treatmentRows = treatmentsResult.data || [];
  const invoiceRows = invoicesResult.data || [];
  const waivedRows = waivedResult.data || [];

  const patientIds = Array.from(new Set([
    ...appointmentRows.map((row) => row.patient_id),
    ...visitRows.map((row) => row.patient_id),
    ...treatmentRows.map((row) => row.patient_id),
    ...waivedRows.map((row) => row.patient_id),
  ].filter(Boolean))) as string[];

  const waivedByIds = Array.from(new Set(waivedRows.map((row) => row.op_fee_waived_by).filter(Boolean))) as string[];

  const [patientsResult, profilesResult] = await Promise.all([
    patientIds.length
      ? supabase.from("patients").select("id,name,patient_code,phone").in("id", patientIds)
      : Promise.resolve({ data: [] as PatientMini[], error: null }),
    waivedByIds.length
      ? supabase.from("profiles").select("id,name").in("id", waivedByIds)
      : Promise.resolve({ data: [] as ProfileMini[], error: null }),
  ]);

  if (patientsResult.error) throw patientsResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const patients = indexById((patientsResult.data || []) as PatientMini[]);
  const profiles = indexById((profilesResult.data || []) as ProfileMini[]);

  const treatmentDueByPatient = new Map<string, number>();
  invoiceRows.forEach((row) => {
    const patientId = row.patient_id as string | null;
    if (!patientId) return;
    treatmentDueByPatient.set(patientId, (treatmentDueByPatient.get(patientId) || 0) + toNumber(row.due_amount));
  });

  const missedFollowups: MissedFollowupReview[] = [
    ...appointmentRows.map((row) => {
      const patient = patients.get(row.patient_id as string);
      return {
        id: String(row.id),
        source: "appointment" as const,
        patient_id: String(row.patient_id),
        patient_name: patientLabel(patient),
        patient_code: patient?.patient_code || null,
        patient_phone: patient?.phone || null,
        due_at: String(row.appointment_time),
        notes: row.notes || null,
      };
    }),
    ...visitRows.map((row) => {
      const patient = patients.get(row.patient_id as string);
      return {
        id: String(row.id),
        source: "visit" as const,
        patient_id: String(row.patient_id),
        patient_name: patientLabel(patient),
        patient_code: patient?.patient_code || null,
        patient_phone: patient?.phone || null,
        due_at: String(row.next_appointment_date),
        notes: row.doctor_notes || null,
      };
    }),
  ].sort((a, b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime()).slice(0, 20);

  const paidActiveTreatments: PaidActiveTreatmentReview[] = treatmentRows
    .filter((row) => (treatmentDueByPatient.get(row.patient_id as string) || 0) <= 0)
    .map((row) => {
      const patient = patients.get(row.patient_id as string);
      return {
        id: String(row.id),
        patient_id: String(row.patient_id),
        patient_name: patientLabel(patient),
        patient_code: patient?.patient_code || null,
        patient_phone: patient?.phone || null,
        treatment_name: row.treatment_name || "Treatment",
        status: row.status || "ongoing",
        cost: toNumber(row.cost),
        created_at: String(row.created_at),
      };
    })
    .slice(0, 20);

  const waivedOpFees: WaivedOpFeeReview[] = waivedRows.map((row) => {
    const patient = patients.get(row.patient_id as string);
    const waivedBy = row.op_fee_waived_by ? profiles.get(row.op_fee_waived_by as string) : null;
    return {
      id: String(row.id),
      patient_id: String(row.patient_id),
      patient_name: patientLabel(patient),
      patient_code: patient?.patient_code || null,
      patient_phone: patient?.phone || null,
      amount: toNumber(row.op_fee_amount),
      reason: row.op_fee_waiver_reason || null,
      created_at: String(row.created_at),
      waived_by_name: waivedBy?.name || null,
    };
  });

  const patientEditsCount = editsResult.count ?? 0;

  const cards: OwnerReviewCard[] = [
    {
      key: "missed-followups",
      title: "Missed Follow-ups",
      count: missedFollowups.length,
      subtitle: missedFollowups.length ? "Call or reschedule these patients." : "No missed follow-ups found.",
      tone: missedFollowups.length ? "danger" : "success",
      route: "/reports/followups",
      action: "Open Follow-ups",
    },
    {
      key: "paid-active",
      title: "Paid but Active",
      count: paidActiveTreatments.length,
      subtitle: paidActiveTreatments.length ? "Doctor should complete or plan next sitting." : "No paid active treatment review needed.",
      tone: paidActiveTreatments.length ? "warning" : "success",
      route: "/reports/treatments",
      action: "Open Treatments",
    },
    {
      key: "waived-op",
      title: "Waived OP Today",
      count: waivedOpFees.length,
      subtitle: waivedOpFees.length ? "Owner should verify why OP fee was waived." : "No OP waivers today.",
      tone: waivedOpFees.length ? "warning" : "success",
      route: "/reports/payments",
      action: "Open Payments",
    },
    {
      key: "patient-edits",
      title: "Patient Edits Today",
      count: patientEditsCount,
      subtitle: patientEditsCount ? "Review identity/contact edits made today." : "No patient detail edits today.",
      tone: patientEditsCount ? "primary" : "success",
      route: "/reports/activity",
      action: "Open Audit",
    },
  ];

  return {
    cards,
    missedFollowups,
    paidActiveTreatments,
    waivedOpFees,
    patientEditsCount,
  };
}
