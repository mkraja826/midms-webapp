import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { acceptStaffInviteByCode, createOwnerClinic } from "@/lib/supabase";

type AccountType = "clinic" | "employee" | null;

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

  const [accountType, setAccountType] = useState<AccountType>(null);
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
      await createOwnerClinic({
        clinicName: clinicName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim() || undefined,
        email: email || undefined,
        address: address.trim() || undefined,
      });

      await refreshProfile();

      Alert.alert(
        "Clinic created",
        "Your clinic workspace is ready. Your free 3-month trial has started.",
        [
          {
            text: "Open Dashboard",
            onPress: () => router.replace("/" as never),
          },
        ]
      );
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
    } catch (error) {
      Alert.alert("Logout failed", getErrorMessage(error));
    }
  }

  function AccountChoice({
    type,
    title,
    subtitle,
    icon,
  }: {
    type: Exclude<AccountType, null>;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
  }) {
    const selected = accountType === type;

    return (
      <Pressable
        onPress={() => setAccountType(type)}
        style={{
          borderRadius: 22,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 18,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
            {title}
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>{subtitle}</Text>
        </View>

        <Ionicons
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          color={selected ? colors.primary : colors.muted}
        />
      </Pressable>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <SectionCard title="Choose account type" subtitle="Select the correct path for this email account.">
        <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>
          Signed in as {email || "this account"}
        </Text>

        <AccountChoice
          type="clinic"
          title="Clinic / Owner"
          icon="business-outline"
          subtitle="Create a new clinic workspace and start the free 3-month trial."
        />

        <AccountChoice
          type="employee"
          title="Employee / Staff"
          icon="people-outline"
          subtitle="Join an existing clinic using the invite code shared by the owner."
        />
      </SectionCard>

      {accountType === "clinic" ? (
        <SectionCard title="Create Clinic Profile" subtitle="For clinic owner or head doctor account only.">
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Your 3-month free trial starts automatically after the clinic profile is created.
          </Text>

          <AppInput
            label="Clinic / Hospital Name"
            value={clinicName}
            onChangeText={setClinicName}
            placeholder="Example: Raja Dental Care"
          />

          <AppInput
            label="Owner / Head Doctor Name"
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
            title="Create Clinic & Start Trial"
            icon="medkit-outline"
            onPress={finishOwnerSetup}
            loading={loading}
          />
        </SectionCard>
      ) : null}

      {accountType === "employee" ? (
        <SectionCard title="Join Existing Clinic" subtitle="Employees cannot create a clinic. Use an invite code from the owner.">
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Working doctors, receptionists, and assistants should join the clinic workspace with a staff invite code.
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
            title="Join With Staff Invite Code"
            variant="secondary"
            onPress={joinInvite}
            loading={loading}
          />
        </SectionCard>
      ) : null}

      <SectionCard title="Wrong account?" subtitle="Logout and sign in with the correct owner or staff email.">
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
