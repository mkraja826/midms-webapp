import { getCurrentProfile, Patient, supabase } from "@/lib/supabase";

export type MedicationSuggestion = {
  id: string;
  name: string;
  normalized_name: string;
  usage_count: number;
  last_used_at: string | null;
};

export type PatientMedicationEntry = {
  id: string;
  clinic_id: string;
  patient_id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  prescribed_by: string | null;
  created_at: string;
  patients?: Pick<Patient, "id" | "name" | "phone" | "patient_code"> | null;
};

function normalizeMedicationName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function getMedicationSuggestions(search = "") {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) return [] as MedicationSuggestion[];

  const term = search.trim();
  let query = supabase
    .from("medication_catalog")
    .select("id,name,normalized_name,usage_count,last_used_at")
    .eq("clinic_id", profile.clinic_id)
    .order("usage_count", { ascending: false })
    .order("last_used_at", { ascending: false })
    .limit(20);

  if (term) {
    query = query.ilike("name", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as MedicationSuggestion[];
}

export async function getRecentPatientMedications(patientId?: string) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) return [] as PatientMedicationEntry[];

  let query = supabase
    .from("patient_medications")
    .select("*, patients(id,name,phone,patient_code)")
    .eq("clinic_id", profile.clinic_id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (patientId) query = query.eq("patient_id", patientId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PatientMedicationEntry[];
}

export async function savePatientMedication(input: {
  patient_id: string;
  medication_name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const medicationName = input.medication_name.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeMedicationName(medicationName);

  if (!medicationName) throw new Error("Enter tablet or medicine name.");

  const { data, error } = await supabase
    .from("patient_medications")
    .insert({
      clinic_id: profile.clinic_id,
      patient_id: input.patient_id,
      medication_name: medicationName,
      dosage: input.dosage?.trim() || null,
      frequency: input.frequency?.trim() || null,
      duration: input.duration?.trim() || null,
      instructions: input.instructions?.trim() || null,
      prescribed_by: profile.id,
    })
    .select("*")
    .single();

  if (error) throw error;

  const { data: existing, error: existingError } = await supabase
    .from("medication_catalog")
    .select("id,usage_count")
    .eq("clinic_id", profile.clinic_id)
    .eq("normalized_name", normalizedName)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("medication_catalog")
      .update({
        name: medicationName,
        usage_count: Number(existing.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase.from("medication_catalog").insert({
      clinic_id: profile.clinic_id,
      name: medicationName,
      normalized_name: normalizedName,
      usage_count: 1,
      last_used_at: new Date().toISOString(),
    });

    if (insertError) throw insertError;
  }

  return data as PatientMedicationEntry;
}
