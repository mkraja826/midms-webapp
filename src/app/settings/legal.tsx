import { router } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/supabase";

export default function LegalAccountScreen() {
  const { profile, signOut } = useAuth();
  const homePath = getDashboardPath(profile?.role ?? "receptionist");

  function confirmLogout() {
    Alert.alert("Logout", "Sign out from this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/login" as never);
          } catch (error) {
            Alert.alert("Logout failed", error instanceof Error ? error.message : "Please try again.");
          }
        },
      },
    ]);
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <SectionCard title="Legal & Account" subtitle="Privacy, terms, support, optional features, and account deletion.">
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            DMS Play Store compliance
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Access privacy information, terms, account/data deletion, support, and clinic optional feature settings.
          </Text>
        </View>
      </SectionCard>

      <AppButton
        title="Clinic Optional Features"
        variant="secondary"
        icon="options-outline"
        onPress={() => router.push("/settings/account" as never)}
      />

      <AppButton
        title="Report Issue / Support"
        variant="secondary"
        icon="help-circle-outline"
        onPress={() => router.push("/settings/report-issue" as never)}
      />

      <AppButton
        title="Privacy Help"
        variant="secondary"
        icon="shield-checkmark-outline"
        onPress={() => router.push("/settings/privacy" as never)}
      />

      <AppButton
        title="Terms & Conditions"
        variant="secondary"
        icon="document-text-outline"
        onPress={() => router.push("/settings/terms" as never)}
      />

      <AppButton
        title="Logout"
        variant="secondary"
        icon="log-out-outline"
        onPress={confirmLogout}
      />

      <AppButton
        title="Delete Account & Data"
        variant="danger"
        icon="trash-outline"
        onPress={() => router.push("/settings/delete-account" as never)}
      />

      <AppButton
        title="Back to Dashboard"
        variant="secondary"
        icon="arrow-back-outline"
        onPress={() => router.replace(homePath as never)}
      />
    </ScrollView>
  );
}
