import { ReactNode } from "react";
import { Text, View, ViewStyle } from "react-native";
import { colors } from "@/constants/colors";

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
        borderRadius: 28,
        padding: 16,
        gap: 14,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.shadow,
        shadowOpacity: 0.055,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 9 },
        elevation: 2,
        ...style,
      }}
    >
      {title ? (
        <View style={{ gap: 5 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.2 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}
