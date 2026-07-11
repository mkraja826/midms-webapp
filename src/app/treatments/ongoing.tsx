import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { OngoingTreatmentsSection } from "@/components/OngoingTreatmentsSection";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";

export default function OngoingTreatmentsPage() {
  const { profile } = useAuth();
  const doctorOnly = profile?.role === "doctor" || profile?.role === "working_doctor";
  const allowStatusUpdates = profile?.role !== "receptionist";

  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 17,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="construct-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}>Ongoing Treatments</Text>
            <Text style={{ color: colors.muted, marginTop: 2, lineHeight: 20 }}>
              Planned, ongoing, paid and outstanding treatment work.
            </Text>
          </View>
        </View>
      </View>

      <OngoingTreatmentsSection
        allowStatusUpdates={allowStatusUpdates}
        doctorOnly={doctorOnly}
        limit={50}
      />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton title="Back" icon="arrow-back-outline" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} />
        <AppButton title="Dashboard" icon="home-outline" variant="ghost" onPress={() => router.replace("/" as never)} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
