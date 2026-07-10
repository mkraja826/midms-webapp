import { getCurrentProfile, Profile, supabase } from "@/lib/supabase";

export type ClinicFeatureSettings = {
  enable_patient_photos: boolean;
  enable_medication_module: boolean;
};

export const DEFAULT_CLINIC_FEATURE_SETTINGS: ClinicFeatureSettings = {
  enable_patient_photos: false,
  enable_medication_module: false,
};

export function canManageClinicFeatureSettings(profile?: Profile | null) {
  return profile?.role === "head_doctor" || profile?.role === "owner";
}

export async function getClinicFeatureSettings(): Promise<ClinicFeatureSettings> {
  const profile = await getCurrentProfile();

  if (!profile?.clinic_id) return DEFAULT_CLINIC_FEATURE_SETTINGS;

  const { data, error } = await supabase
    .from("clinics")
    .select("enable_patient_photos,enable_medication_module")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  if (error) throw error;

  return {
    enable_patient_photos: Boolean(data?.enable_patient_photos),
    enable_medication_module: Boolean(data?.enable_medication_module),
  };
}

export async function updateClinicFeatureSettings(input: ClinicFeatureSettings) {
  const profile = await getCurrentProfile();

  if (!profile?.clinic_id) throw new Error("Clinic profile not found");
  if (!canManageClinicFeatureSettings(profile)) {
    throw new Error("Only clinic owner can change optional clinic features.");
  }

  const { data, error } = await supabase
    .from("clinics")
    .update({
      enable_patient_photos: input.enable_patient_photos,
      enable_medication_module: input.enable_medication_module,
    })
    .eq("id", profile.clinic_id)
    .select("enable_patient_photos,enable_medication_module")
    .single();

  if (error) throw error;

  return {
    enable_patient_photos: Boolean(data?.enable_patient_photos),
    enable_medication_module: Boolean(data?.enable_medication_module),
  };
}
