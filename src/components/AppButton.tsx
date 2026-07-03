import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, ViewStyle } from "react-native";
import { colors } from "@/constants/colors";

type Props = {
  title: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function AppButton({
  title,
  onPress,
  icon,
  variant = "primary",
  loading,
  disabled,
  style,
}: Props) {
  const isDisabled = disabled || loading;

  const background =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
      ? colors.danger
      : variant === "ghost"
      ? "transparent"
      : colors.primarySoft;

  const textColor =
    variant === "primary" || variant === "danger"
      ? colors.white
      : variant === "ghost"
      ? colors.primary
      : colors.primaryDark;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({
        minHeight: 54,
        borderRadius: 18,
        paddingHorizontal: 16,
        backgroundColor: isDisabled ? colors.muted : background,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        opacity: pressed ? 0.82 : 1,
        borderWidth: variant === "ghost" ? 1 : 0,
        borderColor: colors.border,
        ...style,
      })}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
          <Text style={{ color: textColor, fontSize: 16, fontWeight: "900" }}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
