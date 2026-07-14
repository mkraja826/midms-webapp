import { getCurrentProfile, supabase } from "@/lib/supabase";

export type ExportRangeKey = "today" | "week" | "month" | "all";

export type OwnerExportSection = {
  title: string;
  csv: string;
  rowCount: number;
};

export type OwnerExportReport = {
  title: string;
  rangeLabel: string;
  generatedAt: string;
  summary: {
    patients: number;
    visits: number;
    payments: number;
    revenue: number;
    pending: number;
    appointments: number;
  };
  sections: OwnerExportSection[];
  exportText: string;
  excelHtml: string;
  excelFileName: string;
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

export function getExportDateRange(key: ExportRangeKey): DateRange {
  if (key === "all") return { start: null, end: null, label: "All records" };

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

async function safeRows<T>(label: string, query: PromiseLike<{ data: T[] | null; error: any }>) {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn(`${label} export query failed:`, error.message || error);
      return [] as T[];
    }
    return (data || []) as T[];
  } catch (error) {
    console.warn(`${label} export query failed:`, error);
    return [] as T[];
  }
}

function csvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/\r?\n/g, " ").trim();
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers: string[], rows: unknown[][]) {
  if (!rows.length) return `${headers.map(csvValue).join(",")}\n`;
  return [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
}

function moneyNumber(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
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

function section(title: string, headers: string[], rows: unknown[][]): OwnerExportSection {
  return {
    title,
    rowCount: rows.length,
    csv: toCsv(headers, rows),
  };
}

function htmlValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function csvToRows(csv: string) {
  return csv
    .trim()
    .split("\n")
    .map((line) => {
      const values: string[] = [];
      let current = "";
      let quoted = false;

      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];

        if (char === '"' && quoted && next === '"') {
          current += '"';
          index += 1;
          continue;
        }

        if (char === '"') {
          quoted = !quoted;
          continue;
        }

        if (char === "," && !quoted) {
          values.push(current);
          current = "";
          continue;
        }

        current += char;
      }

      values.push(current);
      return values;
    });
}

function buildExcelHtml(input: {
  title: string;
  rangeLabel: string;
  generatedAt: string;
  summary: OwnerExportReport["summary"];
  sections: OwnerExportSection[];
}) {
  const summaryRows = [
    ["Range", input.rangeLabel],
    ["Generated", input.generatedAt],
    ["Patients", input.summary.patients],
    ["Visits", input.summary.visits],
    ["Payments", input.summary.payments],
    ["Revenue", `Rs. ${Math.round(input.summary.revenue).toLocaleString("en-IN")}`],
    ["Pending", `Rs. ${Math.round(input.summary.pending).toLocaleString("en-IN")}`],
    ["Appointments", input.summary.appointments],
  ];

  const summaryTable = `
    <table>
      <tr><th colspan="2">Summary</th></tr>
      ${summaryRows.map((row) => `<tr><td>${htmlValue(row[0])}</td><td>${htmlValue(row[1])}</td></tr>`).join("")}
    </table>
  `;

  const sectionTables = input.sections
    .map((item) => {
      const rows = csvToRows(item.csv);
      const headers = rows[0] || [];
      const body = rows.slice(1);

      return `
        <h2>${htmlValue(item.title)} (${item.rowCount})</h2>
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${htmlValue(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${
              body.length
                ? body
                    .map((row) => `<tr>${row.map((cell) => `<td>${htmlValue(cell)}</td>`).join("")}</tr>`)
                    .join("")
                : `<tr><td colspan="${Math.max(headers.length, 1)}">No records</td></tr>`
            }
          </tbody>
        </table>
      `;
    })
    .join("<br />");

  return `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>CapDent Export</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
  <style>
    body { font-family: Arial, sans-serif; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 16px; margin-top: 22px; margin-bottom: 8px; }
    p { color: #4b5563; }
    table { border-collapse: collapse; margin-bottom: 14px; width: 100%; }
    th { background: #e0f2fe; color: #0f172a; font-weight: 700; }
    th, td { border: 1px solid #94a3b8; padding: 8px; font-size: 12px; mso-number-format:"\\@"; }
  </style>
</head>
<body>
  <h1>${htmlValue(input.title)}</h1>
  <p>Internal IDs are hidden. Export uses patient names, phone numbers, dates, staff names, and amounts.</p>
  ${summaryTable}
  ${sectionTables}
</body>
</html>
  `.trim();
}

function safeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "export";
}

export async function buildOwnerExport(rangeKey: ExportRangeKey): Promise<OwnerExportReport> {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const range = getExportDateRange(rangeKey);
  const limit = rangeKey === "all" ? 2000 : 500;

  const patientQuery = applyDateRange(
    supabase
      .from("patients")
      .select("id,patient_code,name,phone,gender,age,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const staffQuery = supabase
    .from("profiles")
    .select("id,name,email,role,active,created_at")
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false });

  const [patients, staff] = await Promise.all([
    safeRows<any>("Patients", patientQuery),
    safeRows<any>("Staff", staffQuery),
  ]);

  const patientMap = new Map<string, any>(patients.map((row) => [row.id, row]));
  const staffMap = new Map<string, any>(staff.map((row) => [row.id, row]));

  const visitsQuery = applyDateRange(
    supabase
      .from("patient_visits")
      .select("patient_id,doctor_id,visit_date,chief_complaint,doctor_notes,next_appointment_date,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("visit_date", { ascending: false })
      .limit(limit),
    "visit_date",
    range
  );

  const appointmentsQuery = applyDateRange(
    supabase
      .from("appointments")
      .select("patient_id,doctor_id,appointment_time,status,notes,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("appointment_time", { ascending: false })
      .limit(limit),
    "appointment_time",
    range
  );

  const invoicesQuery = applyDateRange(
    supabase
      .from("invoices")
      .select("patient_id,total_amount,paid_amount,due_amount,status,notes,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const paymentsQuery = applyDateRange(
    supabase
      .from("payments")
      .select("patient_id,amount,payment_method,payment_category,notes,collected_by,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const filesQuery = applyDateRange(
    supabase
      .from("files")
      .select("patient_id,file_type,file_name,uploaded_by,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const medicationsQuery = applyDateRange(
    supabase
      .from("patient_medications")
      .select("patient_id,medication_name,dosage,frequency,duration,instructions,prescribed_by,created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("created_at", { ascending: false })
      .limit(limit),
    "created_at",
    range
  );

  const [visits, appointments, invoices, payments, files, medications] = await Promise.all([
    safeRows<any>("Visits", visitsQuery),
    safeRows<any>("Appointments", appointmentsQuery),
    safeRows<any>("Invoices", invoicesQuery),
    safeRows<any>("Payments", paymentsQuery),
    safeRows<any>("Files", filesQuery),
    safeRows<any>("Prescribed tablets", medicationsQuery),
  ]);

  const revenue = payments.reduce((sum, row) => sum + moneyNumber(row.amount), 0);
  const pending = invoices.reduce((sum, row) => sum + moneyNumber(row.due_amount), 0);

  const sections = [
    section(
      "Patients",
      ["Patient", "Phone", "Gender", "Age", "Registered"],
      patients.map((row) => [patientLabel(row), row.phone, row.gender, row.age, dateText(row.created_at)])
    ),
    section(
      "Visits",
      ["Patient", "Visit Date", "Doctor", "Chief Complaint", "Doctor Notes", "Next Follow-up"],
      visits.map((row) => [
        patientLabel(patientMap.get(row.patient_id)),
        dateText(row.visit_date),
        staffLabel(staffMap.get(row.doctor_id)),
        row.chief_complaint,
        row.doctor_notes,
        dateText(row.next_appointment_date),
      ])
    ),
    section(
      "Payments Collected",
      ["Patient", "Amount", "Payment Method", "Category", "Collected By", "Notes", "Collected At"],
      payments.map((row) => [
        patientLabel(patientMap.get(row.patient_id)),
        moneyNumber(row.amount),
        row.payment_method,
        row.payment_category,
        staffLabel(staffMap.get(row.collected_by)),
        row.notes,
        dateText(row.created_at),
      ])
    ),
    section(
      "Invoices / Pending",
      ["Patient", "Total", "Paid", "Due", "Status", "Notes", "Created"],
      invoices.map((row) => [
        patientLabel(patientMap.get(row.patient_id)),
        moneyNumber(row.total_amount),
        moneyNumber(row.paid_amount),
        moneyNumber(row.due_amount),
        row.status,
        row.notes,
        dateText(row.created_at),
      ])
    ),
    section(
      "Appointments",
      ["Patient", "Appointment Time", "Doctor", "Status", "Notes", "Booked At"],
      appointments.map((row) => [
        patientLabel(patientMap.get(row.patient_id)),
        dateText(row.appointment_time),
        staffLabel(staffMap.get(row.doctor_id)),
        row.status,
        row.notes,
        dateText(row.created_at),
      ])
    ),
    section(
      "Uploaded Files",
      ["Patient", "File Type", "File Name", "Uploaded By", "Uploaded At"],
      files.map((row) => [
        patientLabel(patientMap.get(row.patient_id)),
        row.file_type,
        row.file_name,
        staffLabel(staffMap.get(row.uploaded_by)),
        dateText(row.created_at),
      ])
    ),
    section(
      "Prescribed Tablets",
      ["Patient", "Tablet", "Dosage", "Frequency", "Duration", "Instructions", "Entered By", "Entered At"],
      medications.map((row) => [
        patientLabel(patientMap.get(row.patient_id)),
        row.medication_name,
        row.dosage,
        row.frequency,
        row.duration,
        row.instructions,
        staffLabel(staffMap.get(row.prescribed_by)),
        dateText(row.created_at),
      ])
    ),
    section(
      "Staff",
      ["Name", "Role", "Email", "Active", "Added At"],
      staff.map((row) => [row.name, roleLabel(row.role), row.email, row.active ? "Yes" : "No", dateText(row.created_at)])
    ),
  ];

  const generatedAt = dateText(new Date().toISOString());
  const summary = {
    patients: patients.length,
    visits: visits.length,
    payments: payments.length,
    revenue,
    pending,
    appointments: appointments.length,
  };

  const title = `CapDent Owner Export - ${range.label}`;
  const exportText = [
    title,
    `Generated: ${generatedAt}`,
    "Internal IDs are hidden. Export uses patient names, phone numbers, dates, staff names, and amounts.",
    "",
    "Summary",
    `Patients: ${summary.patients}`,
    `Visits: ${summary.visits}`,
    `Payments: ${summary.payments}`,
    `Revenue: Rs. ${Math.round(summary.revenue).toLocaleString("en-IN")}`,
    `Pending: Rs. ${Math.round(summary.pending).toLocaleString("en-IN")}`,
    `Appointments: ${summary.appointments}`,
    "",
    ...sections.flatMap((item) => [
      `--- ${item.title} (${item.rowCount}) ---`,
      item.csv,
      "",
    ]),
  ].join("\n");

  const excelHtml = buildExcelHtml({ title, rangeLabel: range.label, generatedAt, summary, sections });
  const excelFileName = `capdent-owner-export-${safeFilePart(range.label)}-${new Date().toISOString().slice(0, 10)}.xls`;

  return {
    title,
    rangeLabel: range.label,
    generatedAt,
    summary,
    sections,
    exportText,
    excelHtml,
    excelFileName,
  };
}
