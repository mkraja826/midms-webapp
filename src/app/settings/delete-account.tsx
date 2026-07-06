import { Linking, ScrollView, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth";

const SUPPORT_EMAIL = "karthikraja826@gmail.com";

export default function DeleteAccountScreen() {
  const { profile } = useAuth();

  const subject = encodeURIComponent("DMS account and data deletion request");
  const body = encodeURIComponent(
    `Hello DMS Support,

I want to request deletion of my DMS account and related clinic data.

Account email: ${profile?.email ?? ""}
Clinic ID: ${profile?.clinic_id ?? ""}
Role: ${profile?.role ?? ""}

I understand that deleting clinic data may affect patient records, appointment history, uploaded files, payment history, and staff access.

Please confirm the deletion process.

Regards,
${profile?.name ?? ""}`
  );

  function requestDeletion() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <SectionCard title="Delete Account & Data" subtitle="Request account and clinic data deletion.">
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>What can be deleted?</Text>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            You may request deletion of your login account and related clinic data, including clinic profile,
            staff access, patient records, appointments, visits, uploaded prescriptions, X-rays, photos, payment
            records, and reminders, where legally and operationally possible.
          </Text>

          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Important clinic notice</Text>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Dental clinics may need to retain some medical, billing, or legal records where required by law,
            professional obligations, dispute resolution, security, or fraud-prevention needs.
          </Text>

          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>How to request deletion</Text>
          <Text style={{ color: colors.muted, lineHeight: 21 }}>
            Tap the button below to send a deletion request from your registered email. Support will verify the
            request before deleting or restricting access to data.
          </Text>
        </View>
      </SectionCard>

      <AppButton title="Request deletion by email" variant="danger" icon="trash-outline" onPress={requestDeletion} />
      <AppButton title="Back" variant="secondary" icon="arrow-back-outline" onPress={() => router.back()} />
    </ScrollView>
  );
}
