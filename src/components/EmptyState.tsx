import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { colors } from "@/constants/colors";

export function EmptyState({
  title,
  message,
  body,
  icon = "file-tray-outline",
}: {
  title: string;
  message?: string;
  body?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const copy = message ?? body ?? "";

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 10,
      }}
    >
      <Ionicons name={icon} size={38} color={colors.muted} />
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
        {title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
        {copy}
      </Text>
    </View>
  );
}
