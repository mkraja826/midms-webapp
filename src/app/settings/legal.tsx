import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";

export default function LegalAccountScreen() {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;

    try {
      setSigningOut(true);
      await signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to log out. Please try again.";
      Alert.alert("Logout failed", message);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <SectionCard title="Legal & Account" subtitle="Privacy, terms, support, logout, and account deletion.">
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            CapDent account controls
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Access privacy information, terms and conditions, logout, and account or data deletion options.
          </Text>
        </View>
      </SectionCard>

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
        title="Log Out"
        variant="secondary"
        icon="log-out-outline"
        loading={signingOut}
        loadingTitle="Logging out..."
        onPress={() => void handleSignOut()}
      />

      <AppButton
        title="Delete Account & Data"
        variant="danger"
        icon="trash-outline"
        onPress={() => router.push("/settings/delete-account" as never)}
      />

      <AppButton
        title="Back"
        variant="secondary"
        icon="arrow-back-outline"
        onPress={() => router.back()}
      />
    </ScrollView>
  );
}
