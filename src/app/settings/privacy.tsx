import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";

function Row({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 9, alignItems: "flex-start" }}>
      <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: colors.text, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>Privacy Help</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Basic privacy and support information for clinic users.
        </Text>
      </View>

      <SectionCard title="Privacy" subtitle="Add final live policy link before release.">
        <Row text="The app is used for clinic records, appointments, uploads, payments, and staff access." />
        <Row text="Only authorized clinic staff should use the app." />
        <Row text="Keep login details private and do not share staff accounts." />
      </SectionCard>

      <SectionCard title="Account support" subtitle="Add final support link before release.">
        <Row text="Staff can ask the clinic owner or support contact to remove login access." />
        <Row text="Clinic records may need to stay available for clinic record keeping." />
      </SectionCard>

      <SectionCard title="Disclaimer" subtitle="Clinic workflow only.">
        <Row text="This app is for clinic management and record keeping." />
        <Row text="Clinical decisions remain with clinic professionals." />
      </SectionCard>

      <AppButton title="Back" icon="arrow-back-outline" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
