import * as FileSystem from "expo-file-system/legacy";
import { getCurrentProfile, supabase } from "@/lib/supabase";

export type ClinicBrand = {
  id: string;
  name: string;
  logo_url: string | null;
  phone?: string | null;
  address?: string | null;
  brand_color?: string | null;
};

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

export async function getClinicBrand() {
  const profile = await getCurrentProfile();

  if (!profile?.clinic_id) return null;

  const { data, error } = await supabase
    .from("clinics")
    .select("id,name,logo_url,phone,address,brand_color")
    .eq("id", profile.clinic_id)
    .maybeSingle();

  if (error) throw error;

  return data as ClinicBrand | null;
}

export async function uploadClinicLogo(uri: string) {
  const profile = await getCurrentProfile();

  if (!profile?.clinic_id) {
    throw new Error("Clinic profile not found");
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const bytes = base64ToUint8Array(base64);
  const path = `${profile.clinic_id}/logo-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("clinic-logos")
    .upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("clinic-logos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("clinics")
    .update({
      logo_url: data.publicUrl,
    })
    .eq("id", profile.clinic_id);

  if (updateError) throw updateError;

  return data.publicUrl;
}

export async function updateClinicBrand(input: {
  name: string;
  phone?: string;
  address?: string;
  logoUri?: string | null;
}) {
  const profile = await getCurrentProfile();

  if (!profile?.clinic_id) {
    throw new Error("Clinic profile not found");
  }

  let logoUrl: string | undefined;

  if (input.logoUri) {
    logoUrl = await uploadClinicLogo(input.logoUri);
  }

  const payload: Record<string, string | null> = {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
  };

  if (logoUrl) {
    payload.logo_url = logoUrl;
  }

  const { data, error } = await supabase
    .from("clinics")
    .update(payload)
    .eq("id", profile.clinic_id)
    .select("id,name,logo_url,phone,address,brand_color")
    .single();

  if (error) throw error;

  return data as ClinicBrand;
}
