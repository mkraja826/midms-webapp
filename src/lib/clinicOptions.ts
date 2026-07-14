import { getCurrentProfile, Profile, supabase } from "@/lib/supabase";

export type ClinicFeatureSettings = {
  enable_patient_photos: boolean;
  enable_prescription_medications: boolean;
  op_fee_amount: number;
};

export const DEFAULT_OP_FEE_AMOUNT = 300;

export const DEFAULT_CLINIC_FEATURE_SETTINGS: ClinicFeatureSettings = {
  enable_patient_photos: false,
  enable_prescription_medications: false,
  op_fee_amount: DEFAULT_OP_FEE_AMOUNT,
};

const CLINIC_FEATURE_CACHE_TTL_MS = 120_000;

let cachedClinicFeatures:
  | {
      clinicId: string;
      settings: ClinicFeatureSettings;
      expiresAt: number;
    }
  | null = null;

export function invalidateClinicFeatureSettingsCache() {
  cachedClinicFeatures = null;
}

export function cleanClinicOpFee(value: unknown) {
  const amount = Math.round(Number(value || DEFAULT_OP_FEE_AMOUNT));
  if (!Number.isFinite(amount) || amount <= 0) return DEFAULT_OP_FEE_AMOUNT;
  return amount;
}

export function canManageClinicFeatureSettings(profile?: Profile | null) {
  return profile?.role === "head_doctor" || profile?.role === "owner";
}

export async function getClinicFeatureSettings(options?: { force?: boolean }): Promise<ClinicFeatureSettings> {
  const profile = await getCurrentProfile();

  if (!profile?.clinic_id) return DEFAULT_CLINIC_FEATURE_SETTINGS;

  const now = Date.now();
  if (
    !options?.force &&
    cachedClinicFeatures?.clinicId === profile.clinic_id &&
    cachedClinicFeatures.expiresAt > now
  ) {
    return cachedClinicFeatures.settings;
  }

  const { data, error } = await supabase
    .from("clinics")
    .select("enable_patient_photos,enable_prescription_medications,op_fee_amount")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  if (error) throw error;

  const settings = {
    enable_patient_photos: Boolean(data?.enable_patient_photos),
    enable_prescription_medications: Boolean(data?.enable_prescription_medications),
    op_fee_amount: cleanClinicOpFee(data?.op_fee_amount),
  };

  cachedClinicFeatures = {
    clinicId: profile.clinic_id,
    settings,
    expiresAt: Date.now() + CLINIC_FEATURE_CACHE_TTL_MS,
  };

  return settings;
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
      enable_prescription_medications: input.enable_prescription_medications,
      op_fee_amount: cleanClinicOpFee(input.op_fee_amount),
    })
    .eq("id", profile.clinic_id)
    .select("enable_patient_photos,enable_prescription_medications,op_fee_amount")
    .single();

  if (error) throw error;

  const settings = {
    enable_patient_photos: Boolean(data?.enable_patient_photos),
    enable_prescription_medications: Boolean(data?.enable_prescription_medications),
    op_fee_amount: cleanClinicOpFee(data?.op_fee_amount),
  };

  cachedClinicFeatures = {
    clinicId: profile.clinic_id,
    settings,
    expiresAt: Date.now() + CLINIC_FEATURE_CACHE_TTL_MS,
  };

  return settings;
}
