import { router } from "expo-router";
import { useEffect } from "react";
import { Text } from "react-native";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";

export default function MedicationFeeRedirectScreen() {
  useEffect(() => {
    router.replace({ pathname: "/payment/fee", params: { fee_type: "medication_fee" } } as never);
  }, []);

  return (
    <Screen>
      <Text style={{ color: colors.muted }}>Opening Medication Fee...</Text>
    </Screen>
  );
}
