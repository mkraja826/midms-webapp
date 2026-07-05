import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const uploadProvider = (process.env.EXPO_PUBLIC_UPLOAD_PROVIDER ?? "supabase").toLowerCase();
const shouldUseR2Storage = uploadProvider === "r2";
const shouldRequireR2Storage = process.env.EXPO_PUBLIC_UPLOAD_STRICT_R2 === "true";

const hasRealSupabaseUrl =
  /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/.test(supabaseUrl) &&
  !supabaseUrl.includes("your-project");

const hasRealSupabaseKey =
  supabaseAnonKey.length > 40 &&
  !supabaseAnonKey.includes("your-anon-key");

export const isSupabaseConfigured = hasRealSupabaseUrl && hasRealSupabaseKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Role =
  | "head_doctor"
  | "working_doctor"
  | "receptionist"
  | "owner"
  | "doctor";

export type NormalizedRole = "head_doctor" | "working_doctor" | "receptionist";

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type InvoiceStatus = "unpaid" | "partial" | "paid";
export type PaymentCategory =
  | "op_fee"
  | "xray_fee"
  | "medication_fee"
  | "treatment_fee"
  | "pending_collection"
  | "other";
export type FileType =
  | "prescription"
  | "xray"
  | "before_photo"
  | "after_photo"
  | "report"
  | "other";

export type UploadProgressPhase = "preparing" | "uploading" | "saving" | "complete";

export type UploadProgressState = {
  phase: UploadProgressPhase;
  percent: number;
  bytesSent?: number;
  totalBytes?: number;
  message: string;
};

type StorageUploadResult = {
  provider: "supabase" | "r2";
  storagePath: string;
  publicUrl: string;
};

type R2SignedUpload = {
  provider: "r2";
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  bucket: string;
  expiresIn: number;
  headers: Record<string, string>;
};

export type Profile = {
  id: string;
  clinic_id: string | null;
  name: string;
  email: string | null;
  role: Role;
  invite_code?: string | null;
  active: boolean;
  created_at: string;
};

export type Clinic = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
};

export type Patient = {
  id: string;
  clinic_id: string;
  patient_code: string | null;
  name: string;
  gender: string | null;
  age: number | null;
  dob?: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergency_contact: string | null;
  created_at: string;
};

export type MedicalHistory = {
  id: string;
  patient_id: string;
  heart_issue: boolean;
  kidney_issue: boolean;
  brain_issue: boolean;
  diabetes: boolean;
  blood_pressure: boolean;
  allergies: string | null;
  current_medicines: string | null;
  other_notes: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_time: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  patients?: Pick<Patient, "id" | "name" | "phone"> | null;
  profiles?: Pick<Profile, "id" | "name"> | null;
};

export type Visit = {
  id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  visit_date: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  doctor_notes: string | null;
  next_appointment_date: string | null;
  created_at: string;
};

export type Treatment = {
  id: string;
  clinic_id: string;
  visit_id: string | null;
  patient_id: string;
  treatment_name: string;
  description: string | null;
  cost: number;
  status: "planned" | "ongoing" | "completed" | "cancelled";
  created_at: string;
};

export type PatientFile = {
  id: string;
  clinic_id: string;
  patient_id: string;
  visit_id: string | null;
  file_type: FileType;
  file_url: string;
  file_name: string;
  file_note?: string | null;
  xray_amount?: number | null;
  xray_fee_status?: "not_applicable" | "pending" | "paid" | "waived" | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  clinic_id: string;
  patient_id: string;
  visit_id: string | null;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  status: InvoiceStatus;
  payment_category?: PaymentCategory | null;
  notes?: string | null;
  created_at: string;
  patients?: Pick<Patient, "id" | "name" | "phone"> | null;
};

export type PatientAuditLog = {
  id: string;
  clinic_id: string;
  patient_id: string;
  changed_by: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
};

export type DashboardStats = {
  todayAppointments: number;
  totalPatients: number;
  pendingPayments: number;
  todayRevenue: number;
  recentPatients: Patient[];
  todayAppointmentList: Appointment[];
};

export type WorkflowDashboardSummary = {
  today_revenue?: number | null;
  pending_payments?: number | null;
  op_fee_revenue_today?: number | null;
  xray_revenue_today?: number | null;
  medication_revenue_today?: number | null;
  treatment_revenue_today?: number | null;
  pending_collected_today?: number | null;
  other_revenue_today?: number | null;
  today_patient_count?: number | null;
  waiting_count?: number | null;
  completed_count?: number | null;
};

export type StaffInvite = {
  id: string;
  clinic_id: string;
  email: string;
  name: string;
  role: Role;
  invite_code: string | null;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
};

export function normalizeRole(role: Role): NormalizedRole {
  if (role === "owner") return "head_doctor";
  if (role === "doctor") return "working_doctor";
  return role;
}

export function getDashboardPath(role: Role) {
  const normalized = normalizeRole(role);
  if (normalized === "head_doctor") return "/(head)/dashboard";
  if (normalized === "working_doctor") return "/(doctor)/dashboard";
  return "/(reception)/dashboard";
}

export function getRoleSegment(role: Role) {
  const normalized = normalizeRole(role);
  if (normalized === "head_doctor") return "(head)";
  if (normalized === "working_doctor") return "(doctor)";
  return "(reception)";
}

export function getRoleLabel(role: Role) {
  const normalized = normalizeRole(role);
  if (normalized === "head_doctor") return "Head Doctor / Owner";
  if (normalized === "working_doctor") return "Working Doctor";
  return "Receptionist";
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function invoiceStatus(total: number, paid: number): InvoiceStatus {
  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}

function normalizeForAudit(value: unknown) {
  if (value === undefined || value === null) return null;
  return String(value);
}

function rangeForPreset(preset: "today" | "yesterday" | "week" | "month") {
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

function dashboardWarn(label: string, error: unknown) {
  if (!error) return;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  console.warn(`${label}:`, message);
}

async function safeDashboardQuery(label: string, query: PromiseLike<any>) {
  try {
    const result = await query;
    if (result?.error) dashboardWarn(label, result.error);
    return result ?? { data: [], error: null, count: 0 };
  } catch (error) {
    dashboardWarn(label, error);
    return { data: [], error, count: 0 };
  }
}

function base64ToUint8Array(base64: string) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const value = chars.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

function clampUploadPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function emitUploadProgress(
  onProgress: ((progress: UploadProgressState) => void) | undefined,
  progress: UploadProgressState
) {
  onProgress?.({
    ...progress,
    percent: clampUploadPercent(progress.percent),
  });
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function storageUploadError(status: number, body: string) {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message || parsed.error || `Storage upload failed with status ${status}`;
  } catch {
    return body || `Storage upload failed with status ${status}`;
  }
}

function unknownErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Unknown error";
}

function isResponseLike(value: unknown): value is { status: number; text: () => Promise<string> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    "text" in value &&
    typeof (value as { text?: unknown }).text === "function"
  );
}

async function edgeFunctionErrorMessage(error: unknown) {
  const context = typeof error === "object" && error && "context" in error
    ? (error as { context?: unknown }).context
    : null;

  if (isResponseLike(context)) {
    const body = await context.text().catch(() => "");
    return storageUploadError(context.status, body);
  }

  return unknownErrorMessage(error);
}

async function readFileBlob(uri: string) {
  const fileResponse = await fetch(uri);
  if (!fileResponse.ok) {
    throw new Error("Unable to read the selected file.");
  }

  return fileResponse.blob();
}

async function uploadBlobToUrlWithProgress(input: {
  url: string;
  method: "POST" | "PUT";
  body: Blob;
  headers: Record<string, string>;
  onProgress?: (progress: UploadProgressState) => void;
  startPercent: number;
  endPercent: number;
  message: string;
}) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open(input.method, input.url);
    Object.entries(input.headers).forEach(([key, value]) => {
      if (value) xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      const totalBytes = event.lengthComputable ? event.total : input.body.size;
      const rawPercent = totalBytes > 0 ? event.loaded / totalBytes : 0;

      emitUploadProgress(input.onProgress, {
        phase: "uploading",
        percent: input.startPercent + rawPercent * (input.endPercent - input.startPercent),
        bytesSent: event.loaded,
        totalBytes,
        message: input.message,
      });
    };

    xhr.onerror = () => reject(new Error("Network error while uploading file."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        emitUploadProgress(input.onProgress, {
          phase: "saving",
          percent: input.endPercent,
          bytesSent: input.body.size,
          totalBytes: input.body.size,
          message: "Upload received, saving patient record",
        });
        resolve();
        return;
      }

      reject(new Error(storageUploadError(xhr.status, xhr.responseText)));
    };

    xhr.send(input.body);
  });
}

async function uploadSupabaseStorageObjectWithProgress(input: {
  bucket: "prescriptions" | "xrays" | "patient-files";
  storagePath: string;
  uri: string;
  mimeType?: string | null;
  onProgress?: (progress: UploadProgressState) => void;
}): Promise<StorageUploadResult> {
  emitUploadProgress(input.onProgress, {
    phase: "preparing",
    percent: 0,
    message: "Preparing selected file",
  });

  try {
    const body = await readFileBlob(input.uri);
    const uploadUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${input.bucket}/${encodeStoragePath(
      input.storagePath
    )}`;
    const { data: sessionData } = await supabase.auth.getSession();
    const bearerToken = sessionData.session?.access_token ?? supabaseAnonKey;

    emitUploadProgress(input.onProgress, {
      phase: "uploading",
      percent: 3,
      bytesSent: 0,
      totalBytes: body.size,
      message: "Starting secure upload",
    });

    await uploadBlobToUrlWithProgress({
      url: uploadUrl,
      method: "POST",
      body,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${bearerToken}`,
        "cache-control": "max-age=3600",
        "content-type": input.mimeType || body.type || "application/octet-stream",
        "x-upsert": "false",
      },
      onProgress: input.onProgress,
      startPercent: 3,
      endPercent: 93,
      message: "Uploading file",
    });
  } catch (progressUploadError) {
    emitUploadProgress(input.onProgress, {
      phase: "uploading",
      percent: 35,
      message: "Retrying secure upload",
    });

    const base64 = await FileSystem.readAsStringAsync(input.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = base64ToUint8Array(base64);

    const { error: uploadError } = await supabase.storage
      .from(input.bucket)
      .upload(input.storagePath, bytes, {
        contentType: input.mimeType ?? "application/octet-stream",
      });

    if (uploadError) {
      const originalMessage =
        progressUploadError instanceof Error ? progressUploadError.message : "Progress upload failed";
      throw new Error(`${uploadError.message}\n${originalMessage}`);
    }

    emitUploadProgress(input.onProgress, {
      phase: "saving",
      percent: 93,
      message: "Upload received, saving patient record",
    });
  }

  const { data: publicUrl } = supabase.storage
    .from(input.bucket)
    .getPublicUrl(input.storagePath);

  return {
    provider: "supabase",
    storagePath: input.storagePath,
    publicUrl: publicUrl.publicUrl,
  };
}

async function uploadR2StorageObjectWithProgress(input: {
  patient_id: string;
  file_type: FileType;
  uri: string;
  file_name: string;
  mimeType?: string | null;
  onProgress?: (progress: UploadProgressState) => void;
}): Promise<StorageUploadResult> {
  emitUploadProgress(input.onProgress, {
    phase: "preparing",
    percent: 0,
    message: "Preparing selected file",
  });

  const body = await readFileBlob(input.uri);
  const mimeType = input.mimeType || body.type || "application/octet-stream";

  emitUploadProgress(input.onProgress, {
    phase: "preparing",
    percent: 4,
    bytesSent: 0,
    totalBytes: body.size,
    message: "Requesting R2 upload link",
  });

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    throw new Error("Login session expired. Please sign out and sign in again before uploading.");
  }

  const { data, error } = await supabase.functions.invoke<R2SignedUpload>("create-r2-upload-url", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      patient_id: input.patient_id,
      file_type: input.file_type,
      file_name: input.file_name,
      mime_type: mimeType,
    },
  });

  if (error) throw new Error(await edgeFunctionErrorMessage(error));
  if (!data?.uploadUrl || !data.publicUrl || !data.objectKey) {
    throw new Error("R2 upload link was not returned.");
  }

  emitUploadProgress(input.onProgress, {
    phase: "uploading",
    percent: 8,
    bytesSent: 0,
    totalBytes: body.size,
    message: "Uploading file to Cloudflare R2",
  });

  await uploadBlobToUrlWithProgress({
    url: data.uploadUrl,
    method: "PUT",
    body,
    headers: data.headers || { "Content-Type": mimeType },
    onProgress: input.onProgress,
    startPercent: 8,
    endPercent: 93,
    message: "Uploading file to Cloudflare R2",
  });

  return {
    provider: "r2",
    storagePath: data.objectKey,
    publicUrl: data.publicUrl,
  };
}

export async function getCurrentProfile() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .eq("active", true)
    .maybeSingle<Profile>();

  if (error) throw error;
  return data;
}

export async function createOwnerClinic(input: {
  clinicName: string;
  ownerName: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  const { data, error } = await supabase.rpc("create_owner_clinic", {
    clinic_name: input.clinicName,
    owner_name: input.ownerName,
    clinic_phone: input.phone || null,
    clinic_email: input.email || null,
    clinic_address: input.address || null,
  });

  if (error) throw error;
  return data as Profile;
}

export async function acceptStaffInviteByCode(code: string) {
  const { data, error } = await supabase.rpc("accept_staff_invite_by_code", {
    code: code.trim().toUpperCase(),
  });

  if (error) throw error;
  return data as Profile;
}

export async function acceptStaffInvite() {
  const { data, error } = await supabase.rpc("accept_staff_invite");
  if (error) throw error;
  return data as Profile;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [
    patients,
    appointments,
    invoices,
    todayPayments,
    todayInvoices,
    pendingCharges,
    paidChargesToday,
  ] = await Promise.all([
    safeDashboardQuery(
      "Dashboard patients query failed",
      supabase
        .from("patients")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(5)
    ),

    safeDashboardQuery(
      "Dashboard appointments query failed",
      supabase
        .from("appointments")
        .select("*, patients(id,name,phone), profiles(id,name)")
        .gte("appointment_time", todayStart)
        .lte("appointment_time", todayEnd)
        .order("appointment_time", { ascending: true })
    ),

    safeDashboardQuery(
      "Dashboard invoices query failed",
      supabase
        .from("invoices")
        .select("total_amount, paid_amount, due_amount, status")
    ),

    safeDashboardQuery(
      "Dashboard payments query failed",
      supabase
        .from("payments")
        .select("amount, created_at")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
    ),

    safeDashboardQuery(
      "Dashboard today invoices query failed",
      supabase
        .from("invoices")
        .select("paid_amount, created_at")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
    ),

    safeDashboardQuery(
      "Dashboard pending charges query failed",
      supabase
        .from("charges")
        .select("amount, payment_status")
        .in("payment_status", ["pending", "partial"])
    ),

    safeDashboardQuery(
      "Dashboard paid charges query failed",
      supabase
        .from("charges")
        .select("amount, payment_status, created_at")
        .eq("payment_status", "paid")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
    ),
  ]);

  const patientRows = patients.error || !Array.isArray(patients.data) ? [] : patients.data;
  const appointmentRows =
    appointments.error || !Array.isArray(appointments.data) ? [] : appointments.data;
  const invoiceRows = invoices.error || !Array.isArray(invoices.data) ? [] : invoices.data;
  const todayPaymentRows =
    todayPayments.error || !Array.isArray(todayPayments.data) ? [] : todayPayments.data;
  const todayInvoiceRows =
    todayInvoices.error || !Array.isArray(todayInvoices.data) ? [] : todayInvoices.data;
  const pendingChargeRows =
    pendingCharges.error || !Array.isArray(pendingCharges.data) ? [] : pendingCharges.data;
  const paidChargeRows =
    paidChargesToday.error || !Array.isArray(paidChargesToday.data) ? [] : paidChargesToday.data;

  const paymentRevenue = todayPaymentRows.reduce(
    (sum: number, row: { amount?: number | string | null }) => sum + Number(row.amount || 0),
    0
  );

  const invoicePaidToday = todayInvoiceRows.reduce(
    (sum: number, row: { paid_amount?: number | string | null }) => sum + Number(row.paid_amount || 0),
    0
  );

  const paidChargesRevenue = paidChargeRows.reduce(
    (sum: number, row: { amount?: number | string | null }) => sum + Number(row.amount || 0),
    0
  );

  // Prefer actual payments. If no payment rows exist yet, fallback to invoices/charges.
  const todayRevenue =
    paymentRevenue > 0 ? paymentRevenue : invoicePaidToday + paidChargesRevenue;

  const invoicePending = invoiceRows.reduce(
    (sum: number, row: { due_amount?: number | string | null }) => sum + Number(row.due_amount || 0),
    0
  );

  const chargePending = pendingChargeRows.reduce(
    (sum: number, row: { amount?: number | string | null }) => sum + Number(row.amount || 0),
    0
  );

  return {
    totalPatients: patients.count ?? 0,
    recentPatients: patientRows as Patient[],
    todayAppointments: appointmentRows.length,
    todayAppointmentList: appointmentRows as Appointment[],
    pendingPayments: invoicePending + chargePending,
    todayRevenue,
  };
}

export async function getWorkflowDashboardSummary(): Promise<WorkflowDashboardSummary | null> {
  const result = await safeDashboardQuery(
    "Dashboard workflow summary query failed",
    supabase.rpc("get_workflow_dashboard_summary")
  );

  if (result.error) return null;

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return (row ?? null) as WorkflowDashboardSummary | null;
}


export async function getPatients() {
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Patient[];
}

export async function searchPatients(query: string) {
  const term = query.trim();
  if (!term) return getPatients();

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Patient[];
}

export async function searchPatientsAdvanced(input: {
  query?: string;
  dateField?: "registered" | "visit" | "appointment" | "followup" | "payment";
  preset?: "all" | "today" | "yesterday" | "week" | "month" | "custom";
  startDate?: string;
  endDate?: string;
}) {
  const term = input.query?.trim() ?? "";
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
      .gte(column, start)
      .lte(column, end);

    if (error) throw error;

    patientIds = Array.from(
      new Set((data ?? []).map((row: { patient_id?: string | null }) => row.patient_id).filter(Boolean))
    ) as string[];

    if (!patientIds.length) return [];
  }

  let queryBuilder = supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

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

  const { data, error } = await queryBuilder;

  if (error) throw error;
  return data as Patient[];
}

export async function createPatient(input: {
  name: string;
  gender?: string;
  age?: number;
  phone?: string;
  email?: string;
  address?: string;
  emergency_contact?: string;
  medical_history?: Partial<MedicalHistory>;
}) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const { medical_history, ...patientInput } = input;

  const { data: patient, error } = await supabase
    .from("patients")
    .insert({
      ...patientInput,
      clinic_id: profile.clinic_id,
      patient_code: `DMS-${Date.now().toString().slice(-6)}`,
    })
    .select("*")
    .single<Patient>();

  if (error) throw error;

  await createMedicalHistory(patient.id, medical_history ?? {});
  return patient;
}

function optionalDateToIso(value?: string | null) {
  const clean = value?.trim();
  if (!clean) return undefined;

  const date = new Date(`${clean}T12:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString();
}

export async function createOldPatient(input: {
  name: string;
  gender?: string;
  age?: number;
  phone?: string;
  email?: string;
  address?: string;
  emergency_contact?: string;
  old_patient_code?: string;
  registered_date?: string;
  last_visit_date?: string;
  old_record_notes?: string;
  opening_balance?: number;
  opening_balance_note?: string;
  medical_history?: Partial<MedicalHistory>;
}) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const registeredAt = optionalDateToIso(input.registered_date);
  const lastVisitAt = optionalDateToIso(input.last_visit_date);
  const oldCode = input.old_patient_code?.trim();
  const balance = Math.max(Number(input.opening_balance ?? 0), 0);

  const { medical_history, old_record_notes, opening_balance_note, ...patientInput } = input;
  const { old_patient_code, registered_date, last_visit_date, opening_balance, ...cleanPatientInput } = patientInput;

  const { data: patient, error } = await supabase
    .from("patients")
    .insert({
      ...cleanPatientInput,
      clinic_id: profile.clinic_id,
      patient_code: oldCode || `OLD-${Date.now().toString().slice(-6)}`,
      created_at: registeredAt ?? new Date().toISOString(),
    })
    .select("*")
    .single<Patient>();

  if (error) throw error;

  await createMedicalHistory(patient.id, medical_history ?? {});

  if (lastVisitAt || old_record_notes?.trim()) {
    const { error: visitError } = await supabase.from("patient_visits").insert({
      clinic_id: profile.clinic_id,
      patient_id: patient.id,
      doctor_id: profile.id,
      visit_date: lastVisitAt ?? new Date().toISOString(),
      chief_complaint: "Old patient record",
      diagnosis: null,
      doctor_notes: old_record_notes?.trim() || "Old clinic record imported into DMS.",
      next_appointment_date: null,
    });

    if (visitError) throw visitError;
  }

  if (balance > 0) {
    const { error: invoiceError } = await supabase.from("invoices").insert({
      clinic_id: profile.clinic_id,
      patient_id: patient.id,
      visit_id: null,
      total_amount: balance,
      paid_amount: 0,
      due_amount: balance,
      status: "unpaid",
    });

    if (invoiceError) throw invoiceError;
  }

  return patient;
}

export async function getPatientById(id: string) {
  const [patient, history, visits, treatments, invoices, files] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).single<Patient>(),
    supabase
      .from("medical_history")
      .select("*")
      .eq("patient_id", id)
      .maybeSingle<MedicalHistory>(),
    getPatientVisits(id),
    getPatientTreatments(id),
    getPatientInvoices(id),
    getPatientFiles(id),
  ]);

  if (patient.error) throw patient.error;
  if (history.error) throw history.error;

  return {
    patient: patient.data,
    history: history.data,
    visits,
    treatments,
    invoices,
    files,
  };
}

export async function updatePatient(id: string, input: Partial<Patient>) {
  const { data, error } = await supabase
    .from("patients")
    .update(input)
    .eq("id", id)
    .select("*")
    .single<Patient>();

  if (error) throw error;
  return data;
}

export async function updatePatientWithAudit(
  id: string,
  input: Pick<Partial<Patient>, "name" | "phone" | "age" | "gender" | "address">,
  reason?: string
) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const { data: before, error: beforeError } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single<Patient>();

  if (beforeError) throw beforeError;

  const updated = await updatePatient(id, input);

  const fields = ["name", "phone", "age", "gender", "address"] as const;
  const auditRows = fields
    .filter((field) => normalizeForAudit(before[field]) !== normalizeForAudit(input[field]))
    .map((field) => ({
      clinic_id: profile.clinic_id,
      patient_id: id,
      changed_by: profile.id,
      field_name: field,
      old_value: normalizeForAudit(before[field]),
      new_value: normalizeForAudit(input[field]),
      reason: reason?.trim() || null,
    }));

  if (auditRows.length) {
    const { error: auditError } = await supabase.from("patient_audit_logs").insert(auditRows);
    if (auditError) {
      console.warn("Patient audit insert failed:", auditError.message);
    }
  }

  return updated;
}

export async function getPatientAuditLogs(patientId: string) {
  const { data, error } = await supabase
    .from("patient_audit_logs")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    console.warn("Patient audit load failed:", error.message);
    return [] as PatientAuditLog[];
  }

  return data as PatientAuditLog[];
}

export async function createMedicalHistory(
  patientId: string,
  input: Partial<MedicalHistory>
) {
  const { data, error } = await supabase
    .from("medical_history")
    .insert({
      patient_id: patientId,
      heart_issue: false,
      kidney_issue: false,
      brain_issue: false,
      diabetes: false,
      blood_pressure: false,
      ...input,
    })
    .select("*")
    .single<MedicalHistory>();

  if (error) throw error;
  return data;
}

export async function updateMedicalHistory(
  patientId: string,
  input: Partial<MedicalHistory>
) {
  const { data, error } = await supabase
    .from("medical_history")
    .update(input)
    .eq("patient_id", patientId)
    .select("*")
    .single<MedicalHistory>();

  if (error) throw error;
  return data;
}

export async function createAppointment(input: {
  patient_id: string;
  doctor_id?: string | null;
  appointment_time: string;
  notes?: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...input, clinic_id: profile.clinic_id, status: "scheduled" })
    .select("*")
    .single<Appointment>();

  if (error) throw error;
  return data;
}

export async function getTodayAppointments() {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, patients(id,name,phone), profiles(id,name)")
    .gte("appointment_time", startOfToday())
    .lte("appointment_time", endOfToday())
    .order("appointment_time", { ascending: true });

  if (error) throw error;
  return data as Appointment[];
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const { data, error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single<Appointment>();

  if (error) throw error;
  return data;
}

export async function createVisit(input: {
  patient_id: string;
  chief_complaint?: string;
  diagnosis?: string;
  doctor_notes?: string;
  next_appointment_date?: string | null;
  treatment_name?: string;
  treatment_cost?: number;
  treatment_category?: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const { treatment_name, treatment_cost, treatment_category, ...visitInput } = input;

  const { data: visit, error } = await supabase
    .from("patient_visits")
    .insert({
      ...visitInput,
      clinic_id: profile.clinic_id,
      doctor_id: profile.id,
      visit_date: new Date().toISOString(),
      visit_status: "completed",
    })
    .select("*")
    .single<Visit>();

  if (error) throw error;

  if (treatment_name && treatment_cost !== undefined) {
    await createTreatment({
      patient_id: input.patient_id,
      visit_id: visit.id,
      treatment_name,
      cost: treatment_cost,
      status: "planned",
      category: treatment_category,
    });
  }

  return visit;
}

export async function getPatientVisits(patientId: string) {
  const { data, error } = await supabase
    .from("patient_visits")
    .select("*")
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false });

  if (error) throw error;
  return data as Visit[];
}

export async function createTreatment(input: {
  patient_id: string;
  visit_id?: string | null;
  treatment_name: string;
  description?: string;
  cost: number;
  status?: Treatment["status"];
  category?: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const { data, error } = await supabase
    .from("treatments")
    .insert({
      patient_id: input.patient_id,
      visit_id: input.visit_id ?? null,
      treatment_name: input.treatment_name,
      description: input.description ?? null,
      cost: input.cost,
      status: input.status ?? "planned",
      category: input.category ?? null,
      clinic_id: profile.clinic_id,
    })
    .select("*")
    .single<Treatment>();

  if (error) throw error;
  return data;
}

export async function getPatientTreatments(patientId: string) {
  const { data, error } = await supabase
    .from("treatments")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Treatment[];
}

export async function uploadPatientFile(input: {
  patient_id: string;
  visit_id?: string | null;
  file_type: FileType;
  bucket: "prescriptions" | "xrays" | "patient-files";
  uri: string;
  file_name: string;
  mimeType?: string | null;
  file_note?: string | null;
  xray_amount?: number;
  xray_fee_status?: "not_applicable" | "pending" | "paid" | "waived";
  onProgress?: (progress: UploadProgressState) => void;
}) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const storagePath = `${profile.clinic_id}/${input.patient_id}/${Date.now()}-${input.file_name}`;
  let storageResult: StorageUploadResult;

  if (shouldUseR2Storage) {
    try {
      storageResult = await uploadR2StorageObjectWithProgress({
        patient_id: input.patient_id,
        file_type: input.file_type,
        uri: input.uri,
        file_name: input.file_name,
        mimeType: input.mimeType,
        onProgress: input.onProgress,
      });
    } catch (r2UploadError) {
      const r2Message = r2UploadError instanceof Error ? r2UploadError.message : "Unknown R2 upload error";

      if (shouldRequireR2Storage) {
        throw new Error(`Cloudflare R2 upload failed: ${r2Message}`);
      }

      emitUploadProgress(input.onProgress, {
        phase: "uploading",
        percent: 20,
        message: `R2 unavailable, retrying Supabase Storage: ${r2Message}`,
      });

      storageResult = await uploadSupabaseStorageObjectWithProgress({
        bucket: input.bucket,
        storagePath,
        uri: input.uri,
        mimeType: input.mimeType,
        onProgress: input.onProgress,
      });
    }
  } else {
    storageResult = await uploadSupabaseStorageObjectWithProgress({
      bucket: input.bucket,
      storagePath,
      uri: input.uri,
      mimeType: input.mimeType,
      onProgress: input.onProgress,
    });
  }

  emitUploadProgress(input.onProgress, {
    phase: "saving",
    percent: 96,
    message: "Saving file details",
  });

  const filePayload = {
    clinic_id: profile.clinic_id,
    patient_id: input.patient_id,
    visit_id: input.visit_id ?? null,
    file_type: input.file_type,
    file_url: storageResult.publicUrl,
    file_name: input.file_name,
    uploaded_by: profile.id,
    file_note: input.file_note ?? null,
    xray_amount: input.file_type === "xray" ? Number(input.xray_amount ?? 0) : 0,
    xray_fee_status:
      input.file_type === "xray" ? input.xray_fee_status ?? "not_applicable" : "not_applicable",
  };

  let response = await supabase
    .from("files")
    .insert(filePayload)
    .select("*")
    .single<PatientFile>();

  if (response.error && response.error.code === "PGRST204") {
    response = await supabase
      .from("files")
      .insert({
        clinic_id: profile.clinic_id,
        patient_id: input.patient_id,
        visit_id: input.visit_id ?? null,
        file_type: input.file_type,
        file_url: storageResult.publicUrl,
        file_name: input.file_name,
        uploaded_by: profile.id,
      })
      .select("*")
      .single<PatientFile>();
  }

  if (response.error) throw response.error;

  const xrayAmount = Number(input.xray_amount ?? 0);
  if (input.file_type === "xray" && xrayAmount > 0 && input.xray_fee_status !== "waived") {
    await createInvoice({
      patient_id: input.patient_id,
      visit_id: input.visit_id ?? null,
      total_amount: xrayAmount,
      paid_amount: input.xray_fee_status === "paid" ? xrayAmount : 0,
      payment_category: "xray_fee",
      notes: input.file_note ?? "X-ray fee",
    });
  }

  emitUploadProgress(input.onProgress, {
    phase: "complete",
    percent: 100,
    message: "Upload complete",
  });

  return response.data;
}

export async function getPatientFiles(patientId: string) {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as PatientFile[];
}

async function deletePatientFileDirect(fileId: string) {
  const { data, error } = await supabase
    .from("files")
    .delete()
    .eq("id", fileId)
    .select("id");

  if (error) throw error;

  if (!data?.length) {
    throw new Error("File was not deleted. Run supabase/dms-upload-fix.sql in Supabase SQL Editor, then try again.");
  }
}

export async function deletePatientFileRecord(fileId: string) {
  const { data, error } = await supabase.rpc("delete_patient_file", {
    p_file_id: fileId,
  });

  if (error) {
    const message = error.message || "";
    const functionMissing =
      error.code === "PGRST202" ||
      message.includes("delete_patient_file") ||
      message.includes("Could not find the function");

    if (functionMissing) {
      await deletePatientFileDirect(fileId);
      return true;
    }

    throw error;
  }

  if (data === false) {
    throw new Error("File not found or you do not have permission to delete it.");
  }

  return true;
}

export async function createInvoice(input: {
  patient_id: string;
  visit_id?: string | null;
  total_amount: number;
  paid_amount?: number;
  payment_category?: PaymentCategory;
  notes?: string | null;
}) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const paid = Number(input.paid_amount ?? 0);
  const due = Math.max(Number(input.total_amount) - paid, 0);

  const payload = {
    ...input,
    clinic_id: profile.clinic_id,
    paid_amount: paid,
    due_amount: due,
    status: invoiceStatus(Number(input.total_amount), paid),
    payment_category: input.payment_category ?? "treatment_fee",
    notes: input.notes ?? null,
  };

  let response = await supabase
    .from("invoices")
    .insert(payload)
    .select("*")
    .single<Invoice>();

  if (response.error && response.error.code === "PGRST204") {
    response = await supabase
      .from("invoices")
      .insert({
        patient_id: input.patient_id,
        visit_id: input.visit_id ?? null,
        total_amount: input.total_amount,
        clinic_id: profile.clinic_id,
        paid_amount: paid,
        due_amount: due,
        status: invoiceStatus(Number(input.total_amount), paid),
      })
      .select("*")
      .single<Invoice>();
  }

  if (response.error) throw response.error;

  if (paid > 0) {
    let paymentResponse = await supabase
      .from("payments")
      .insert({
        clinic_id: profile.clinic_id,
        invoice_id: response.data.id,
        patient_id: input.patient_id,
        amount: paid,
        payment_method: "Cash",
        notes: input.notes ?? "Invoice paid at creation",
        payment_category: input.payment_category ?? "treatment_fee",
        collected_by: profile.id,
      });

    if (paymentResponse.error && paymentResponse.error.code === "PGRST204") {
      paymentResponse = await supabase
        .from("payments")
        .insert({
          clinic_id: profile.clinic_id,
          invoice_id: response.data.id,
          patient_id: input.patient_id,
          amount: paid,
          payment_method: "Cash",
          notes: input.notes ?? "Invoice paid at creation",
        });
    }

    if (paymentResponse.error) throw paymentResponse.error;
  }

  return response.data;
}

export async function addPayment(input: {
  invoice_id: string;
  patient_id: string;
  amount: number;
  payment_method?: string;
  notes?: string;
  payment_category?: PaymentCategory;
}) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", input.invoice_id)
    .single<Invoice>();

  if (invoiceError) throw invoiceError;

  let paymentResponse = await supabase
    .from("payments")
    .insert({
      ...input,
      clinic_id: profile.clinic_id,
      collected_by: profile.id,
      payment_category: input.payment_category ?? "pending_collection",
    });

  if (paymentResponse.error && paymentResponse.error.code === "PGRST204") {
    paymentResponse = await supabase
      .from("payments")
      .insert({
        invoice_id: input.invoice_id,
        patient_id: input.patient_id,
        amount: input.amount,
        payment_method: input.payment_method,
        notes: input.notes,
        clinic_id: profile.clinic_id,
      });
  }

  if (paymentResponse.error) throw paymentResponse.error;

  const paid = Number(invoice.paid_amount) + Number(input.amount);
  const due = Math.max(Number(invoice.total_amount) - paid, 0);

  const { data, error: updateError } = await supabase
    .from("invoices")
    .update({
      paid_amount: paid,
      due_amount: due,
      status: invoiceStatus(Number(invoice.total_amount), paid),
    })
    .eq("id", invoice.id)
    .select("*")
    .single<Invoice>();

  if (updateError) throw updateError;
  return data;
}

export async function getPatientInvoices(patientId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Invoice[];
}

export async function getPendingPayments() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, patients(id,name,phone)")
    .gt("due_amount", 0)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Invoice[];
}

export async function getStaff() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Profile[];
}

export async function getStaffInvites() {
  const { data, error } = await supabase
    .from("staff_invites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as StaffInvite[];
}

export async function createStaffInvite(input: {
  name: string;
  email: string;
  role: "working_doctor" | "receptionist" | "doctor";
}) {
  const finalRole = input.role === "doctor" ? "working_doctor" : input.role;

  const { data, error } = await supabase.rpc("create_staff_invite", {
    staff_name: input.name,
    staff_email: input.email.toLowerCase(),
    staff_role: finalRole,
  });

  if (error) throw error;
  return data as StaffInvite;
}

export async function sendStaffInviteEmail(inviteId: string) {
  const { data, error } = await supabase.functions.invoke("send-staff-invite-email", {
    body: { inviteId },
  });

  if (error) throw error;
  return data as { ok: boolean };
}
