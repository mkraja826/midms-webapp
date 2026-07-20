import { ReactNode } from "react";
import { Text, View, ViewStyle } from "react-native";
import { colors, radius } from "@/constants/colors";

export function SectionCard({
  title,
  subtitle,
  children,
  style,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: 15,
        gap: 14,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.shadow,
        shadowOpacity: 0.035,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 1,
        ...style,
      }}
    >
      {title ? (
        <View style={{ gap: 5 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
