import { ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { colors } from "@/constants/colors";

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
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
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
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
