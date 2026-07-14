import { Text, View } from "react-native";
import { colors } from "@/constants/colors";

export function StatusBadge({
  label,
  tone = "primary",
}: {
  label: string;
  tone?: "primary" | "success" | "warning" | "danger";
}) {
  const bg =
    tone === "success"
      ? colors.successSoft
      : tone === "warning"
      ? colors.warningSoft
      : tone === "danger"
      ? colors.dangerSoft
      : colors.primarySoft;

  const fg =
    tone === "success"
      ? colors.success
      : tone === "warning"
      ? colors.warning
      : tone === "danger"
      ? colors.danger
      : colors.primary;

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: bg,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: fg, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
