import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("INVITE_FROM_EMAIL") ?? "CapDent <onboarding@resend.dev>";
    const appName = Deno.env.get("APP_NAME") ?? "CapDent";
    const appUrl = Deno.env.get("APP_URL") ?? "Open the CapDent mobile app";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!resendApiKey) return json({ error: "RESEND_API_KEY is not configured" }, 500);
    if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Supabase function env is missing" }, 500);
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const { inviteId } = await req.json();
    if (!inviteId) return json({ error: "inviteId is required" }, 400);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "Invalid user session" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, role, clinic_id, clinics(name)")
      .eq("id", userData.user.id)
      .single();

    if (profileError) return json({ error: profileError.message }, 403);
    if (profile.role !== "owner") return json({ error: "Only clinic owners can send staff invite emails" }, 403);

    const { data: invite, error: inviteError } = await supabase
      .from("staff_invites")
      .select("id, name, email, role, clinic_id")
      .eq("id", inviteId)
      .eq("clinic_id", profile.clinic_id)
      .single();

    if (inviteError) return json({ error: inviteError.message }, 404);

    const clinicName = profile.clinics?.name ?? "your clinic";
    const roleLabel = invite.role === "doctor" ? "Doctor" : "Receptionist";
    const subject = `${clinicName} invited you to ${appName}`;
    const text = [
      `Hello ${invite.name},`,
      "",
      `${profile.name} has invited you to join ${clinicName} as ${roleLabel} in ${appName}.`,
      "",
      "How to join:",
      "1. Open the CapDent app.",
      `2. Create a staff account using this email: ${invite.email}`,
      "3. Log in and tap Join Invited Clinic.",
      "",
      `${appUrl}`,
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#122033">
        <h2 style="color:#176BCE">You are invited to ${appName}</h2>
        <p>Hello <strong>${invite.name}</strong>,</p>
        <p>${profile.name} has invited you to join <strong>${clinicName}</strong> as <strong>${roleLabel}</strong>.</p>
        <ol>
          <li>Open the CapDent app.</li>
          <li>Create a staff account using <strong>${invite.email}</strong>.</li>
          <li>Log in and tap <strong>Join Invited Clinic</strong>.</li>
        </ol>
        <p>${appUrl}</p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: invite.email,
        subject,
        text,
        html,
      }),
    });

    const result = await response.json();
    if (!response.ok) return json({ error: result?.message ?? "Email provider failed", details: result }, 502);

    return json({ ok: true, id: result.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
