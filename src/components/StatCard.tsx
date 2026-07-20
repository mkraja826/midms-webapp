import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { colors, radius } from "@/constants/colors";

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
        borderRadius: radius.lg,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 108,
        gap: 10,
        shadowColor: colors.shadow,
        shadowOpacity: 0.025,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase" }}>
          {label}
        </Text>
        {icon ? (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              backgroundColor: bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={icon} size={19} color={fg} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ color: colors.text, fontSize: 23, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}
