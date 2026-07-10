import { ReactNode, useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/constants/colors";

export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  scrollToTopKey,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollToTopKey?: string | number | null;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const contentPadding = {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 16,
  };

  useEffect(() => {
    if (scrollToTopKey === undefined) return;

    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 0);

    return () => clearTimeout(timeout);
  }, [scrollToTopKey]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                  progressBackgroundColor={colors.surface}
                />
              ) : undefined
            }
            style={{ flex: 1, backgroundColor: colors.background }}
            contentContainerStyle={contentPadding}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.background, ...contentPadding }}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
