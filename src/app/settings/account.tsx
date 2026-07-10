import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import {
  canManageClinicFeatureSettings,
  ClinicFeatureSettings,
  DEFAULT_CLINIC_FEATURE_SETTINGS,
  getClinicFeatureSettings,
  updateClinicFeatureSettings,
} from "@/lib/clinicOptions";

export default function AccountSettingsScreen() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<ClinicFeatureSettings>(DEFAULT_CLINIC_FEATURE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManage = canManageClinicFeatureSettings(profile);

  async function load() {
    try {
      setLoading(true);
      const data = await getClinicFeatureSettings();
      setSettings(data);
    } catch (error) {
      Alert.alert(
        "Settings load failed",
        error instanceof Error ? error.message : "Please run the optional feature SQL migration and try again."
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
    try {
      setSaving(true);
      const updated = await updateClinicFeatureSettings(settings);
      setSettings(updated);
      Alert.alert("Settings saved", "Clinic optional features were updated for staff dashboards.");
    } catch (error) {
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "Only clinic owner can update these options."
      );
    } finally {
      setSaving(false);
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
            Optional clinic features are controlled by the clinic owner only.
          </Text>
        </View>

        <SectionCard>
          <EmptyState
            title="Owner access only"
            message="Ask the clinic owner or head doctor to turn optional features on or off."
            icon="lock-closed-outline"
          />
        </SectionCard>

        <AppButton title="Back" icon="arrow-back-outline" variant="ghost" onPress={() => router.back()} />
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
          Clinic owner can turn optional modules on or off. Staff dashboards will follow these choices.
        </Text>
      </View>

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
          title="Save Optional Features"
          icon="save-outline"
          onPress={save}
          loading={saving || loading}
        />
      </SectionCard>

      <SectionCard title="Current Behavior">
        <Text style={{ color: colors.muted, lineHeight: 21 }}>
          Patient photos: {settings.enable_patient_photos ? "ON" : "OFF"}
          {"\n"}
          Prescribed tablets section: {settings.enable_prescription_medications ? "ON" : "OFF"}
          {"\n"}
          Medication fee module: unchanged
        </Text>
      </SectionCard>

      <AppButton title="Back" icon="arrow-back-outline" variant="ghost" onPress={() => router.back()} />
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
