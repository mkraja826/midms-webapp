import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const MAX_TOOL_ROUNDS = 5;
const MAX_HISTORY_MESSAGES = 10;
const MAX_ROWS = 50;
const MAX_TOOL_PAYLOAD_CHARS = 30000;

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };
type Profile = { id: string; clinic_id: string; role: string; name: string; active: boolean };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ToolContext = { supabase: any; profile: Profile; clinicId: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown, max = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeLimit(value: unknown, fallback = 20) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(MAX_ROWS, Math.floor(parsed)));
}

function safeOffset(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(5000, Math.floor(parsed)));
}

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dateStart(value: unknown) {
  const v = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00+05:30` : null;
}

function dateEnd(value: unknown) {
  const v = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:59.999+05:30` : null;
}

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object" && ["user", "assistant"].includes(String((item as any).role)))
    .map((item) => ({
      role: (item as any).role as ChatRole,
      content: text((item as any).content, 1400),
    }))
    .filter((item) => item.content)
    .slice(-MAX_HISTORY_MESSAGES);
}

function safeSearchTerm(value: unknown) {
  return text(value, 80).replace(/[(),]/g, " ").replace(/[%_]/g, "").trim();
}

function serializeToolResult(value: unknown) {
  const raw = JSON.stringify(value ?? null);
  if (raw.length <= MAX_TOOL_PAYLOAD_CHARS) return raw;
  return JSON.stringify({
    truncated: true,
    message: "Result was truncated by CapDent. Narrow the query or use pagination.",
    preview: raw.slice(0, MAX_TOOL_PAYLOAD_CHARS),
  });
}

function toolError(error: any) {
  return {
    error: "READ_FAILED",
    message: text(error?.message || "The requested data is unavailable.", 300),
  };
}

function applyRange(query: any, column: string, args: Record<string, unknown>) {
  const start = dateStart(args.start_date);
  const end = dateEnd(args.end_date);
  let next = query;
  if (start) next = next.gte(column, start);
  if (end) next = next.lte(column, end);
  return next;
}

async function getRows(query: any, limit: number, offset: number) {
  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return {
    rows: data ?? [],
    limit,
    offset,
    has_more: Array.isArray(data) && data.length === limit,
  };
}

const tools = [
  {
    type: "function",
    function: {
      name: "get_clinic_overview",
      description: "Get verified CapDent clinic analytics for today, tomorrow, this week, or this month. Use for counts, collections, dues, appointments, visits, treatments, and uploads.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["daily", "tomorrow", "weekly", "monthly"] },
        },
        required: ["period"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_patients",
      description: "Search active or archived patients in the signed-in clinic by name, phone, or patient code before requesting a detailed patient record.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          include_archived: { type: "boolean" },
          limit: { type: "integer", minimum: 1, maximum: MAX_ROWS },
          offset: { type: "integer", minimum: 0 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_patient_record",
      description: "Get a comprehensive read-only record for one patient in the current clinic: identity/contact data, medical history, appointments, visits, treatments, dental chart, medications, invoices, payments, charges, and gallery metadata. Use only when the user asks about a specific patient.",
      parameters: {
        type: "object",
        properties: { patient_id: { type: "string", description: "Patient UUID returned by search_patients." } },
        required: ["patient_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_appointments",
      description: "Read clinic appointments in a date range, optionally filtered by patient or status.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "YYYY-MM-DD in clinic local time." },
          end_date: { type: "string", description: "YYYY-MM-DD in clinic local time." },
          patient_id: { type: "string" },
          status: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: MAX_ROWS },
          offset: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_clinical_records",
      description: "Read recorded clinical activity: visits, treatments, dental chart entries, and patient medications. Filter by patient and/or date range. Summarize recorded data only; never diagnose or prescribe.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { type: "string" },
          start_date: { type: "string", description: "YYYY-MM-DD." },
          end_date: { type: "string", description: "YYYY-MM-DD." },
          limit: { type: "integer", minimum: 1, maximum: MAX_ROWS },
          offset: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_financial_records",
      description: "Read payments, invoices, financial adjustments, invoice versions, and charges for the clinic. Use payment status semantics: active and refund affect net collections; corrected and voided do not count as revenue.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { type: "string" },
          start_date: { type: "string", description: "YYYY-MM-DD." },
          end_date: { type: "string", description: "YYYY-MM-DD." },
          limit: { type: "integer", minimum: 1, maximum: MAX_ROWS },
          offset: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_gallery_records",
      description: "Read patient gallery/file metadata such as X-rays, prescriptions, before/after photos and reports. Raw file URLs and storage paths are deliberately withheld from the model.",
      parameters: {
        type: "object",
        properties: {
          patient_id: { type: "string" },
          file_type: { type: "string" },
          start_date: { type: "string", description: "YYYY-MM-DD." },
          end_date: { type: "string", description: "YYYY-MM-DD." },
          include_archived: { type: "boolean" },
          limit: { type: "integer", minimum: 1, maximum: MAX_ROWS },
          offset: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_staff_and_settings",
      description: "Read clinic settings, staff directory, pending staff invites, subscription status, and pricing settings.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_audit_activity",
      description: "Read recent patient, appointment, clinical, file, management, financial and admin audit activity for the current clinic.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "YYYY-MM-DD." },
          end_date: { type: "string", description: "YYYY-MM-DD." },
          limit: { type: "integer", minimum: 1, maximum: MAX_ROWS },
          offset: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_system_status",
      description: "Read CapDent operational status for the clinic: registered devices (without push tokens), payment notification jobs/deliveries, client errors, and report-export activity.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: MAX_ROWS },
          offset: { type: "integer", minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext) {
  const { supabase, clinicId } = ctx;
  const limit = safeLimit(args.limit);
  const offset = safeOffset(args.offset);

  try {
    if (name === "get_clinic_overview") {
      const period = ["daily", "tomorrow", "weekly", "monthly"].includes(String(args.period)) ? String(args.period) : "daily";
      const result = period === "daily"
        ? await supabase.rpc("get_capdent_ai_today_summary")
        : await supabase.rpc("get_capdent_ai_period_analytics", { p_period: period });
      if (result.error) throw result.error;
      return { period, summary: Array.isArray(result.data) ? result.data[0] ?? null : result.data };
    }

    if (name === "search_patients") {
      const term = safeSearchTerm(args.query);
      if (!term) return { rows: [], message: "Search term is empty." };
      let query = supabase
        .from("patients")
        .select("id,patient_code,name,gender,dob,age,phone,email,created_at,archived_at")
        .eq("clinic_id", clinicId)
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%,patient_code.ilike.%${term}%`)
        .order("updated_at", { ascending: false, nullsFirst: false });
      if (args.include_archived !== true) query = query.is("archived_at", null);
      return await getRows(query, limit, offset);
    }

    if (name === "get_patient_record") {
      if (!isUuid(args.patient_id)) return { error: "INVALID_PATIENT_ID" };
      const patientId = args.patient_id;
      const patientResult = await supabase
        .from("patients")
        .select("id,patient_code,name,gender,dob,age,phone,email,address,emergency_contact,created_at,updated_at,archived_at,archive_reason")
        .eq("clinic_id", clinicId)
        .eq("id", patientId)
        .maybeSingle();
      if (patientResult.error) throw patientResult.error;
      if (!patientResult.data) return { error: "PATIENT_NOT_FOUND" };

      const [medical, appointments, visits, treatments, chart, medications, invoices, payments, charges, files] = await Promise.all([
        supabase.from("medical_history").select("heart_issue,kidney_issue,brain_issue,diabetes,blood_pressure,allergies,current_medicines,other_notes,created_at,updated_at").eq("clinic_id", clinicId).eq("patient_id", patientId).maybeSingle(),
        supabase.from("appointments").select("id,doctor_id,appointment_time,status,notes,op_fee_amount,op_fee_status,created_at,updated_at").eq("clinic_id", clinicId).eq("patient_id", patientId).order("appointment_time", { ascending: false }).limit(100),
        supabase.from("patient_visits").select("id,doctor_id,visit_date,chief_complaint,diagnosis,doctor_notes,next_appointment_date,visit_status,created_at,updated_at").eq("clinic_id", clinicId).eq("patient_id", patientId).order("visit_date", { ascending: false }).limit(100),
        supabase.from("treatments").select("id,visit_id,treatment_name,description,cost,status,category,created_at,updated_at").eq("clinic_id", clinicId).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(100),
        supabase.from("dental_chart_entries").select("id,visit_id,tooth_code,dentition,condition,surfaces,notes,treatment_name,treatment_status,created_at").eq("clinic_id", clinicId).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(120),
        supabase.from("patient_medications").select("id,medication_name,dosage,frequency,duration,instructions,prescribed_by,created_at").eq("clinic_id", clinicId).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(100),
        supabase.from("invoices").select("id,visit_id,total_amount,paid_amount,due_amount,status,invoice_type,payment_category,notes,original_total_amount,discount_amount,waived_amount,refunded_amount,version_number,created_at,updated_at").eq("clinic_id", clinicId).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(100),
        supabase.from("payments").select("id,invoice_id,amount,payment_method,notes,payment_category,status,original_payment_id,created_at,updated_at").eq("clinic_id", clinicId).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(150),
        supabase.from("charges").select("id,visit_id,title,amount,payment_status,created_at").eq("clinic_id", clinicId).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(100),
        supabase.from("files").select("id,visit_id,file_type,file_name,file_note,xray_amount,xray_fee_status,mime_type,original_size_bytes,stored_size_bytes,created_at,archived_at,archive_reason").eq("clinic_id", clinicId).eq("patient_id", patientId).order("created_at", { ascending: false }).limit(100),
      ]);

      const results = { medical, appointments, visits, treatments, chart, medications, invoices, payments, charges, files } as Record<string, any>;
      const errors = Object.entries(results)
        .filter(([, value]) => value?.error)
        .map(([key, value]) => ({ area: key, message: text(value.error.message, 200) }));

      return {
        patient: patientResult.data,
        medical_history: medical.data ?? null,
        appointments: appointments.data ?? [],
        visits: visits.data ?? [],
        treatments: treatments.data ?? [],
        dental_chart: chart.data ?? [],
        medications: medications.data ?? [],
        invoices: invoices.data ?? [],
        payments: payments.data ?? [],
        charges: charges.data ?? [],
        gallery_metadata: files.data ?? [],
        partial_errors: errors,
        read_only: true,
      };
    }

    if (name === "get_appointments") {
      let query = supabase
        .from("appointments")
        .select("id,patient_id,doctor_id,appointment_time,status,notes,op_fee_amount,op_fee_status,reminder_status,created_at,updated_at")
        .eq("clinic_id", clinicId)
        .order("appointment_time", { ascending: false });
      query = applyRange(query, "appointment_time", args);
      if (isUuid(args.patient_id)) query = query.eq("patient_id", args.patient_id);
      if (text(args.status, 40)) query = query.eq("status", text(args.status, 40));
      return await getRows(query, limit, offset);
    }

    if (name === "get_clinical_records") {
      const patientId = isUuid(args.patient_id) ? args.patient_id : null;
      let visits = supabase.from("patient_visits").select("id,patient_id,doctor_id,visit_date,chief_complaint,diagnosis,doctor_notes,next_appointment_date,visit_status,created_at,updated_at").eq("clinic_id", clinicId).order("visit_date", { ascending: false });
      let treatments = supabase.from("treatments").select("id,visit_id,patient_id,treatment_name,description,cost,status,category,created_at,updated_at").eq("clinic_id", clinicId).order("created_at", { ascending: false });
      let chart = supabase.from("dental_chart_entries").select("id,patient_id,visit_id,tooth_code,dentition,condition,surfaces,notes,treatment_name,treatment_status,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false });
      let medications = supabase.from("patient_medications").select("id,patient_id,medication_name,dosage,frequency,duration,instructions,prescribed_by,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false });
      visits = applyRange(visits, "visit_date", args);
      treatments = applyRange(treatments, "created_at", args);
      chart = applyRange(chart, "created_at", args);
      medications = applyRange(medications, "created_at", args);
      if (patientId) {
        visits = visits.eq("patient_id", patientId);
        treatments = treatments.eq("patient_id", patientId);
        chart = chart.eq("patient_id", patientId);
        medications = medications.eq("patient_id", patientId);
      }
      const [v, t, c, m] = await Promise.all([
        getRows(visits, limit, offset),
        getRows(treatments, limit, offset),
        getRows(chart, limit, offset),
        getRows(medications, limit, offset),
      ]);
      return { visits: v, treatments: t, dental_chart: c, medications: m };
    }

    if (name === "get_financial_records") {
      const patientId = isUuid(args.patient_id) ? args.patient_id : null;
      let payments = supabase.from("payments").select("id,invoice_id,patient_id,amount,payment_method,notes,payment_category,status,original_payment_id,collected_by,created_at,updated_at").eq("clinic_id", clinicId).order("created_at", { ascending: false });
      let invoices = supabase.from("invoices").select("id,patient_id,visit_id,total_amount,paid_amount,due_amount,status,invoice_type,payment_category,notes,original_total_amount,discount_amount,waived_amount,refunded_amount,version_number,created_at,updated_at").eq("clinic_id", clinicId).order("created_at", { ascending: false });
      let adjustments = supabase.from("financial_adjustments").select("id,patient_id,invoice_id,payment_id,related_payment_id,adjustment_type,amount,old_values,new_values,reason,notes,created_by,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false });
      let versions = supabase.from("invoice_versions").select("id,patient_id,invoice_id,version_number,change_type,adjustment_id,snapshot,reason,created_by,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false });
      let charges = supabase.from("charges").select("id,patient_id,visit_id,title,amount,payment_status,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false });
      payments = applyRange(payments, "created_at", args);
      invoices = applyRange(invoices, "created_at", args);
      adjustments = applyRange(adjustments, "created_at", args);
      versions = applyRange(versions, "created_at", args);
      charges = applyRange(charges, "created_at", args);
      if (patientId) {
        payments = payments.eq("patient_id", patientId);
        invoices = invoices.eq("patient_id", patientId);
        adjustments = adjustments.eq("patient_id", patientId);
        versions = versions.eq("patient_id", patientId);
        charges = charges.eq("patient_id", patientId);
      }
      const [p, i, a, v, c] = await Promise.all([
        getRows(payments, limit, offset),
        getRows(invoices, limit, offset),
        getRows(adjustments, limit, offset),
        getRows(versions, limit, offset),
        getRows(charges, limit, offset),
      ]);
      const paymentRows = p.rows as Array<{ amount?: unknown; status?: unknown }>;
      const netCollectionsInReturnedPage = paymentRows.reduce((sum, row) => {
        const status = String(row.status || "active").toLowerCase();
        if (!["active", "refund"].includes(status)) return sum;
        const amount = Number(row.amount || 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      return {
        payments: p,
        invoices: i,
        adjustments: a,
        invoice_versions: v,
        charges: c,
        net_collections_in_returned_payment_page: netCollectionsInReturnedPage,
        payment_semantics: "active and refund affect net collections; corrected and voided do not count as revenue",
      };
    }

    if (name === "get_gallery_records") {
      let query = supabase
        .from("files")
        .select("id,patient_id,visit_id,file_type,file_name,file_note,xray_amount,xray_fee_status,mime_type,original_size_bytes,stored_size_bytes,created_at,archived_at,archive_reason")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });
      query = applyRange(query, "created_at", args);
      if (isUuid(args.patient_id)) query = query.eq("patient_id", args.patient_id);
      if (text(args.file_type, 50)) query = query.eq("file_type", text(args.file_type, 50));
      if (args.include_archived !== true) query = query.is("archived_at", null);
      return await getRows(query, limit, offset);
    }

    if (name === "get_staff_and_settings") {
      const [clinic, staff, invites, subscriptions, pricing] = await Promise.all([
        supabase.from("clinics").select("id,name,phone,email,address,active,enable_patient_photos,enable_prescription_medications,op_fee_amount,country_code,currency_code,opening_time,closing_time,payment_push_enabled,tooth_chart_enabled,created_at").eq("id", clinicId).maybeSingle(),
        supabase.from("profiles").select("id,name,email,phone,role,active,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: true }),
        supabase.from("staff_invites").select("id,email,name,role,accepted_at,cancelled_at,cancellation_reason,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false }).limit(100),
        supabase.from("clinic_subscriptions").select("id,plan_name,status,trial_started_at,trial_ends_at,current_period_start,current_period_end,monthly_price,visit_limit,billing_provider,google_play_product_id,google_play_auto_renewing,google_play_status,google_play_linked_at,google_play_last_event_at,google_play_last_verified_at,created_at,updated_at").eq("clinic_id", clinicId).order("updated_at", { ascending: false }).limit(20),
        supabase.from("clinic_pricing_settings").select("pricing_policy_version,patient_limit_enforced,grandfathered,intelligence_enabled_override,multi_clinic_enabled_override,created_at,updated_at").eq("clinic_id", clinicId).maybeSingle(),
      ]);
      return {
        clinic: clinic.data ?? null,
        staff: staff.data ?? [],
        pending_or_previous_invites: invites.data ?? [],
        subscriptions: subscriptions.data ?? [],
        pricing: pricing.data ?? null,
        partial_errors: [clinic, staff, invites, subscriptions, pricing].filter((x) => x.error).map((x) => text(x.error.message, 200)),
      };
    }

    if (name === "get_audit_activity") {
      const make = (table: string, fields: string) => {
        let q = supabase.from(table).select(fields).eq("clinic_id", clinicId).order("created_at", { ascending: false });
        q = applyRange(q, "created_at", args);
        return getRows(q, limit, offset);
      };
      const [patient, appointment, clinical, file, management, admin, adjustments] = await Promise.all([
        make("patient_audit_logs", "id,patient_id,changed_by,field_name,old_value,new_value,reason,created_at"),
        make("appointment_audit_logs", "id,appointment_id,changed_by,action,field_name,old_value,new_value,reason,created_at"),
        make("clinical_audit_logs", "id,patient_id,visit_id,target_type,target_id,changed_by,action,field_name,old_value,new_value,reason,created_at"),
        make("file_audit_logs", "id,patient_id,file_id,changed_by,action,old_value,new_value,reason,created_at"),
        make("management_audit_logs", "id,target_type,target_id,changed_by,action,field_name,old_value,new_value,reason,created_at"),
        make("admin_audit_logs", "id,actor_user_id,actor_email,action,target_type,target_id,details,created_at"),
        make("financial_adjustments", "id,patient_id,invoice_id,payment_id,related_payment_id,adjustment_type,amount,reason,notes,created_by,created_at"),
      ]);
      return { patient, appointment, clinical, file, management, admin, financial_adjustments: adjustments };
    }

    if (name === "get_system_status") {
      const [devices, jobs, deliveries, errors, exports] = await Promise.all([
        getRows(supabase.from("device_push_tokens").select("id,user_id,install_id,platform,device_name,app_version,active,last_seen_at,disabled_at,last_error,created_at,updated_at").eq("clinic_id", clinicId).order("last_seen_at", { ascending: false }), limit, offset),
        getRows(supabase.from("payment_notification_jobs").select("id,payment_id,status,attempts,next_attempt_at,locked_at,processed_at,last_error,created_at,updated_at").eq("clinic_id", clinicId).order("created_at", { ascending: false }), limit, offset),
        getRows(supabase.from("payment_notification_deliveries").select("id,job_id,recipient_user_id,device_token_id,status,attempt_count,expo_ticket_id,expo_receipt_status,error_code,error_detail,sent_at,receipt_checked_at,created_at,updated_at").eq("clinic_id", clinicId).order("created_at", { ascending: false }), limit, offset),
        getRows(supabase.from("admin_client_error_logs").select("id,user_id,release,route,message,context,user_agent,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false }), limit, offset),
        getRows(supabase.from("report_export_logs").select("id,exported_by,report_type,export_format,period_start,period_end,row_count,created_at").eq("clinic_id", clinicId).order("created_at", { ascending: false }), limit, offset),
      ]);
      return { devices, payment_notification_jobs: jobs, payment_notification_deliveries: deliveries, client_errors: errors, report_exports: exports };
    }

    return { error: "UNKNOWN_TOOL" };
  } catch (error) {
    console.error("CapDent AI read tool failed", { tool: name, message: text((error as any)?.message, 300) });
    return toolError(error);
  }
}

async function callGroq(apiKey: string, model: string, messages: any[], withTools: boolean) {
  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      ...(withTools ? { tools, tool_choice: "auto" } : {}),
      temperature: 0.1,
      max_tokens: 700,
      stream: false,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("Groq request failed", {
      status: response.status,
      code: text(payload?.error?.code || payload?.error?.type, 120),
      requestId: response.headers.get("x-request-id"),
    });
    throw new Error(`GROQ_REQUEST_FAILED:${response.status}`);
  }
  return payload;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { message?: string; history?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const userMessage = text(body.message, 1600);
  if (!userMessage) return json({ error: "A question is required." }, 400);

  const authorization = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const groqApiKey = Deno.env.get("GROQ_API_KEY")?.trim() ?? "";
  const groqModel = Deno.env.get("GROQ_MODEL")?.trim() || DEFAULT_MODEL;

  if (!authorization || !supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Authenticated CapDent session required." }, 401);
  }
  if (!groqApiKey) {
    return json({ error: "GROQ_API_KEY is not configured for CapDent AI." }, 503);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "Authenticated CapDent session required." }, 401);

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id,clinic_id,role,name,active")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profileData?.active || !profileData.clinic_id) {
    return json({ error: "An active clinic profile is required." }, 403);
  }

  const profile = profileData as Profile;
  const normalizedRole = profile.role === "owner" ? "head_doctor" : profile.role;
  if (normalizedRole !== "head_doctor") {
    return json({
      error: "Full CapDent AI read-only access is currently limited to clinic owners/head doctors.",
      code: "AI_FULL_READ_OWNER_ONLY",
    }, 403);
  }

  const history = normalizeHistory(body.history);
  const system = [
    "You are CapDent AI, the read-only clinic intelligence assistant for the authenticated clinic owner/head doctor.",
    `The clinic local date is ${localDate()} in Asia/Kolkata.`,
    "For every factual question about this clinic, use one or more provided tools. Never answer clinic facts from memory or assumptions.",
    "The tools are read-only and already scoped to the authenticated clinic. You cannot write, delete, edit, reschedule, prescribe, or change permissions.",
    "You may summarize recorded diagnoses, medical history, medications, dental-chart entries and treatment notes when the user asks about an existing patient, but never create a new diagnosis, prescribe medication, or recommend a treatment as a clinical decision.",
    "For financial answers, respect CapDent payment semantics: active and refund rows affect net collections; corrected and voided rows do not count as revenue. Distinguish collections, billed amount and outstanding dues.",
    "When a user names a patient but you do not yet have the patient UUID, call search_patients first, then get_patient_record if needed.",
    "Do not expose secrets or credentials. Raw storage paths, raw file URLs and Expo push tokens are intentionally unavailable.",
    "If a tool reports access denied, missing data, or a partial error, say that clearly instead of inventing an answer.",
    "Keep answers concise unless the user explicitly asks for detail. Use plain text and short bullets when useful.",
  ].join(" ");

  const messages: any[] = [
    { role: "system", content: system },
    ...history,
    { role: "user", content: userMessage },
  ];

  const usedTools: string[] = [];
  const ctx: ToolContext = { supabase, profile, clinicId: profile.clinic_id };

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const payload = await callGroq(groqApiKey, groqModel, messages, true);
      const assistant = payload?.choices?.[0]?.message;
      if (!assistant) throw new Error("GROQ_EMPTY_RESPONSE");

      const toolCalls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls as ToolCall[] : [];
      if (!toolCalls.length) {
        const answer = text(assistant.content, 5000) || "I couldn't produce a verified answer from the clinic records.";
        return json({
          connected: true,
          provider: "groq",
          model: groqModel,
          answer,
          used_tools: [...new Set(usedTools)],
          read_only: true,
          clinic_scoped: true,
          role: profile.role,
        });
      }

      messages.push({
        role: "assistant",
        content: assistant.content ?? null,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls.slice(0, 6)) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        usedTools.push(call.function.name);
        const result = await executeTool(call.function.name, args, ctx);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: serializeToolResult(result),
        });
      }
    }

    messages.push({ role: "user", content: "Answer now using only the tool results already provided. If the data is insufficient, say what is missing." });
    const finalPayload = await callGroq(groqApiKey, groqModel, messages, false);
    const finalText = text(finalPayload?.choices?.[0]?.message?.content, 5000);
    return json({
      connected: true,
      provider: "groq",
      model: groqModel,
      answer: finalText || "I couldn't produce a verified answer from the available clinic records.",
      used_tools: [...new Set(usedTools)],
      read_only: true,
      clinic_scoped: true,
      role: profile.role,
      tool_round_limit_reached: true,
    });
  } catch (error) {
    console.error("CapDent AI agent failed", { message: text((error as any)?.message, 300), model: groqModel });
    return json({ error: "CapDent AI could not complete this read-only request.", provider: "groq", model: groqModel }, 502);
  }
});
