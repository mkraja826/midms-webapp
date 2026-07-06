import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";

export default function LegalAccountScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <SectionCard title="Legal & Account" subtitle="Privacy, terms, support, and account deletion.">
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            DMS Play Store compliance
          </Text>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Access the app privacy information, terms and conditions, and account/data deletion request options.
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
