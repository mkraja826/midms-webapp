import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UploadBody = {
  patient_id?: string;
  file_type?: string;
  file_name?: string;
  mime_type?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function cleanSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function encodeObjectKey(key: string) {
  return key
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function makePublicUrl(baseUrl: string, objectKey: string) {
  return `${baseUrl.replace(/\/$/, "")}/${encodeObjectKey(objectKey)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
    const accountId = requiredEnv("R2_ACCOUNT_ID");
    const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
    const bucket = requiredEnv("R2_BUCKET");
    const publicBaseUrl = requiredEnv("R2_PUBLIC_BASE_URL");
    const expiresIn = Math.max(60, Math.min(Number(Deno.env.get("R2_UPLOAD_EXPIRES_SECONDS") ?? 600), 3600));
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const body = (await req.json()) as UploadBody;
    const patientId = body.patient_id?.trim();
    const fileType = cleanSegment(body.file_type || "patient-file") || "patient-file";
    const fileName = cleanSegment(body.file_name || "upload.bin") || "upload.bin";
    const mimeType = body.mime_type?.trim() || "application/octet-stream";

    if (!patientId) return json({ error: "patient_id is required" }, 400);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "Invalid user session" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, clinic_id, active")
      .eq("id", userData.user.id)
      .eq("active", true)
      .single();

    if (profileError || !profile?.clinic_id) {
      return json({ error: "Clinic profile not found" }, 403);
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .eq("clinic_id", profile.clinic_id)
      .single();

    if (patientError || !patient) {
      return json({ error: "Patient not found for this clinic" }, 404);
    }

    const objectKey = [
      cleanSegment(profile.clinic_id),
      cleanSegment(patientId),
      fileType,
      `${Date.now()}-${fileName}`,
    ].join("/");

    const r2Url = `https://${accountId}.r2.cloudflarestorage.com`;
    const client = new AwsClient({
      service: "s3",
      region: "auto",
      accessKeyId,
      secretAccessKey,
    });

    const signedRequest = await client.sign(
      new Request(`${r2Url}/${bucket}/${encodeObjectKey(objectKey)}?X-Amz-Expires=${expiresIn}`, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
      }),
      { aws: { signQuery: true } }
    );

    return json({
      provider: "r2",
      uploadUrl: signedRequest.url,
      publicUrl: makePublicUrl(publicBaseUrl, objectKey),
      objectKey,
      bucket,
      expiresIn,
      headers: {
        "Content-Type": mimeType,
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
