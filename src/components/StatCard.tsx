import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { colors } from "@/constants/colors";

export function StatCard({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
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
        flex: 1,
        minWidth: "47%",
        backgroundColor: colors.surface,
        borderRadius: 22,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 14,
            backgroundColor: bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={20} color={fg} />
        </View>
      ) : null}
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>
        {value}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}
