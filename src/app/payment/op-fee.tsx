import { router } from "expo-router";
import { useEffect } from "react";
import { Text } from "react-native";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";

export default function OpFeeRedirectScreen() {
  useEffect(() => {
    router.replace({ pathname: "/payment/fee", params: { fee_type: "op_fee" } } as never);
  }, []);

  return (
    <Screen>
      <Text style={{ color: colors.muted }}>Opening OP Fee...</Text>
    </Screen>
  );
}
