import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/constants/colors";

export function ActionCard({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      hitSlop={6}
      android_ripple={{ color: "rgba(15, 118, 110, 0.10)", borderless: false }}
      style={({ pressed }) => ({
        minHeight: 82,
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 14,
        borderWidth: 1,
        borderColor: pressed ? colors.primary : colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.995 : 1 }],
        shadowColor: colors.shadow,
        shadowOpacity: 0.04,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 7 },
        elevation: 1,
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 18,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(15, 118, 110, 0.12)",
        }}
      >
        <Ionicons name={icon} size={23} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
          {title}
        </Text>
        <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}
