import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { acceptStaffInviteByCode, supabase } from "@/lib/supabase";

function getErrorMessage(error: unknown) {
  if (!error) return "Unknown error";

  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const err = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      err.message,
      err.details ? `Details: ${err.details}` : "",
      err.hint ? `Hint: ${err.hint}` : "",
      err.code ? `Code: ${err.code}` : "",
    ].filter(Boolean);

    if (parts.length) return parts.join("\n");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export default function OnboardingScreen() {
  const { refreshProfile, session, signOut } = useAuth();
  const email = session?.user.email ?? "";

  const [inviteCode, setInviteCode] = useState("");

  const [clinicName, setClinicName] = useState("");
  const [ownerName, setOwnerName] = useState(
    session?.user.user_metadata?.full_name ?? ""
  );
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(false);

  async function finishOwnerSetup() {
    if (!clinicName.trim() || !ownerName.trim()) {
      Alert.alert("Missing details", "Clinic name and head doctor name are required.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.rpc("create_owner_clinic", {
        clinic_name: clinicName.trim(),
        owner_name: ownerName.trim(),
        clinic_phone: phone.trim() || null,
        clinic_email: email || null,
        clinic_address: address.trim() || null,
      });

      if (error) throw error;

      await refreshProfile();

      Alert.alert("Clinic created", "Owner setup completed successfully.", [
        {
          text: "Open Dashboard",
          onPress: () => router.replace("/" as never),
        },
      ]);
    } catch (error) {
      Alert.alert("Clinic setup failed", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function joinInvite() {
    if (!inviteCode.trim()) {
      Alert.alert("Invite code required", "Enter the clinic invite code.");
      return;
    }

    setLoading(true);

    try {
      await acceptStaffInviteByCode(inviteCode.trim());
      await refreshProfile();
      router.replace("/" as never);
    } catch (error) {
      Alert.alert("Join failed", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await signOut();
      router.replace("/login" as never);
    } catch (error) {
      Alert.alert("Logout failed", getErrorMessage(error));
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <SectionCard title="Create Clinic">
        <Text style={{ color: colors.muted, lineHeight: 21 }}>
          Create clinic first. Add logo later from Clinic Branding after dashboard opens.
        </Text>

        <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>
          Signed in as {email || "this account"}
        </Text>

        <AppInput
          label="Clinic / Hospital Name"
          value={clinicName}
          onChangeText={setClinicName}
          placeholder="Example: Raja Dental Care"
        />

        <AppInput
          label="Head Doctor Name"
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="Doctor name"
        />

        <AppInput
          label="Clinic Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Optional"
        />

        <AppInput
          label="Clinic Address"
          value={address}
          onChangeText={setAddress}
          multiline
          placeholder="Optional"
        />

        <AppButton
          title="Create Clinic"
          icon="medkit-outline"
          onPress={finishOwnerSetup}
          loading={loading}
        />
      </SectionCard>

      <SectionCard title="Join Existing Clinic">
        <Text style={{ color: colors.muted, lineHeight: 21 }}>
          Use this only for working doctors or receptionists who received an invite code.
        </Text>

        <AppInput
          label="Invite Code"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="DMS-ABC123"
        />

        <AppButton
          title="Join Invited Clinic"
          variant="secondary"
          onPress={joinInvite}
          loading={loading}
        />
      </SectionCard>

      <SectionCard title="Wrong account?">
        <AppButton
          title="Logout"
          icon="log-out-outline"
          variant="ghost"
          onPress={logout}
        />
      </SectionCard>
    </ScrollView>
  );
}
