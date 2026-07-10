import * as FileSystem from "expo-file-system/legacy";
import { getCurrentProfile, supabase } from "@/lib/supabase";

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

export async function uploadPatientProfilePhoto(patientId: string, uri: string) {
  const profile = await getCurrentProfile();

  if (!profile?.clinic_id) throw new Error("Clinic profile not found");
  if (!patientId) throw new Error("Patient ID missing");

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const bytes = base64ToUint8Array(base64);
  const path = `${profile.clinic_id}/${patientId}/profile-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("patient-files")
    .upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("patient-files").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("patients")
    .update({ photo_url: data.publicUrl })
    .eq("id", patientId)
    .eq("clinic_id", profile.clinic_id);

  if (updateError) throw updateError;

  return data.publicUrl;
}
