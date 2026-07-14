import { router } from "expo-router";
import { Linking, ScrollView, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";

const SUPPORT_EMAIL = "support@micirql.com";
const DELETE_ACCOUNT_URL = "https://dms.micirql.com/delete-account";

export default function DeleteAccountScreen() {
  const { profile } = useAuth();

  const subject = encodeURIComponent("CapDent account and data deletion request");
  const body = encodeURIComponent(
    `Hello CapDent Support,

I want to request deletion of my CapDent account and related clinic data.

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

  function openDeletePage() {
    Linking.openURL(DELETE_ACCOUNT_URL);
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
            Tap the button below to open the public deletion page or send a deletion request email. Support will verify
            the request before deleting or restricting access to data.
          </Text>
        </View>
      </SectionCard>

      <AppButton title="Open Delete Account Page" variant="secondary" icon="open-outline" onPress={openDeletePage} />
      <AppButton title="Request deletion by email" variant="danger" icon="trash-outline" onPress={requestDeletion} />
      <AppButton title="Back" variant="secondary" icon="arrow-back-outline" onPress={() => router.back()} />
    </ScrollView>
  );
}
