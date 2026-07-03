import { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { colors } from "@/constants/colors";

export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 36,
        gap: 16,
        backgroundColor: colors.background,
      }}
    >
      {children}
    </ScrollView>
  );
}
