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
        borderRadius: 26,
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.shadow,
        shadowOpacity: 0.05,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
        ...style,
      }}
    >
      {title ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
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
