import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import {
  canManageClinicFeatureSettings,
  cleanClinicOpFee,
  ClinicFeatureSettings,
  DEFAULT_CLINIC_FEATURE_SETTINGS,
  getClinicFeatureSettings,
  updateClinicFeatureSettings,
} from "@/lib/clinicOptions";
import { getDashboardPath } from "@/lib/supabase";

function money(value: string | number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function toNumber(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

export default function AccountSettingsScreen() {
  const { profile, signOut } = useAuth();
  const [settings, setSettings] = useState<ClinicFeatureSettings>(DEFAULT_CLINIC_FEATURE_SETTINGS);
  const [opFeeAmount, setOpFeeAmount] = useState(String(DEFAULT_CLINIC_FEATURE_SETTINGS.op_fee_amount));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const canManage = canManageClinicFeatureSettings(profile);
  const homePath = getDashboardPath(profile?.role ?? "receptionist");

  async function load() {
    try {
      setLoading(true);
      const data = await getClinicFeatureSettings({ force: true });
      setSettings(data);
      setOpFeeAmount(String(data.op_fee_amount));
    } catch (error) {
      Alert.alert(
        "Settings load failed",
        error instanceof Error ? error.message : "Please run the clinic settings SQL migration and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile?.clinic_id]);

  function setFeature(key: keyof ClinicFeatureSettings, value: boolean) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const cleanedOpFee = cleanClinicOpFee(toNumber(opFeeAmount));

    if (cleanedOpFee <= 0) {
      Alert.alert("Invalid OP fee", "OP fee must be greater than zero.");
      return;
    }

    try {
      setSaving(true);
      const updated = await updateClinicFeatureSettings({
        ...settings,
        op_fee_amount: cleanedOpFee,
      });
      setSettings(updated);
      setOpFeeAmount(String(updated.op_fee_amount));
      Alert.alert("Settings saved", "Clinic OP fee and optional features were updated for staff dashboards.");
    } catch (error) {
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "Only clinic owner can update these options."
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await signOut();
    } catch (error) {
      Alert.alert(
        "Logout failed",
        error instanceof Error ? error.message : "Please try again."
      );
      setLoggingOut(false);
    }
  }

  if (!canManage) {
    return (
      <Screen>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
            Account Settings
          </Text>
          <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
            Clinic account settings are controlled by the clinic owner only.
          </Text>
        </View>

        <SectionCard>
          <EmptyState
            title="Owner access only"
            message="Ask the clinic owner or head doctor to change OP fee, patient photos, or prescribed tablets settings."
            icon="lock-closed-outline"
          />
        </SectionCard>

        <View style={{ gap: 12 }}>
          <AppButton
            title="Back to Dashboard"
            icon="arrow-back-outline"
            variant="ghost"
            onPress={() => router.replace(homePath as never)}
          />

          <AppButton
            title="Logout"
            icon="log-out-outline"
            variant="danger"
            onPress={logout}
            loading={loggingOut}
            loadingTitle="Logging out..."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Account Settings
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Clinic owner can set the clinic OP fee and turn optional modules on or off.
        </Text>
      </View>

      <SectionCard title="Clinic OP Fee" subtitle="This becomes the default amount for quick check-in and OP fee collection.">
        <View style={{ padding: 16, borderRadius: 24, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.border, alignItems: "center", gap: 6 }}>
          <Text style={{ color: colors.muted, fontWeight: "800" }}>Current OP Fee</Text>
          <Text style={{ color: colors.text, fontSize: 42, fontWeight: "900" }}>{money(opFeeAmount)}</Text>
          <Text style={{ color: colors.success, fontWeight: "900" }}>Used by reception desk</Text>
        </View>

        <AppInput
          label="OP Fee Amount"
          value={opFeeAmount}
          onChangeText={setOpFeeAmount}
          keyboardType="numeric"
          placeholder="300"
          helper="Example: 300, 500, 700. Reception can still edit per patient if needed."
        />
      </SectionCard>

      <SectionCard title="Optional Clinic Features" subtitle="Keep these off unless the clinic really wants to use them.">
        <FeatureSwitch
          title="Patient profile photos"
          subtitle="When on, receptionist can upload a patient photo and reception dashboard will show it."
          value={settings.enable_patient_photos}
          onValueChange={(value) => setFeature("enable_patient_photos", value)}
        />

        <FeatureSwitch
          title="Prescribed tablets section"
          subtitle="When on, receptionist can enter tablets prescribed to a patient and reuse repeated medicine names. Medication fee collection is not changed."
          value={settings.enable_prescription_medications}
          onValueChange={(value) => setFeature("enable_prescription_medications", value)}
        />

        <AppButton
          title="Save Clinic Settings"
          icon="save-outline"
          onPress={save}
          loading={saving || loading}
        />
      </SectionCard>

      <SectionCard title="Current Behavior">
        <Text style={{ color: colors.muted, lineHeight: 21 }}>
          OP fee default: {money(settings.op_fee_amount)}
          {"\n"}
          Patient photos: {settings.enable_patient_photos ? "ON" : "OFF"}
          {"\n"}
          Prescribed tablets section: {settings.enable_prescription_medications ? "ON" : "OFF"}
          {"\n"}
          Medication fee module: unchanged
        </Text>
      </SectionCard>

      <View style={{ gap: 12 }}>
        <AppButton
          title="Back to Dashboard"
          icon="arrow-back-outline"
          variant="ghost"
          onPress={() => router.replace(homePath as never)}
        />

        <AppButton
          title="Logout"
          icon="log-out-outline"
          variant="danger"
          onPress={logout}
          loading={loggingOut}
          loadingTitle="Logging out..."
        />
      </View>
    </Screen>
  );
}

function FeatureSwitch({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
          {title}
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 19 }}>
          {subtitle}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primarySoft, false: colors.border }}
        thumbColor={value ? colors.primary : "#FFFFFF"}
      />
    </View>
  );
}
