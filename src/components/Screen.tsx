import { ReactNode, useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { usePathname } from "expo-router";
import { OngoingTreatmentsSection } from "@/components/OngoingTreatmentsSection";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";

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
  const pathname = usePathname();
  const { profile } = useAuth();
  const isDashboard = pathname.includes("/dashboard");
  const doctorOnly = profile?.role === "doctor" || profile?.role === "working_doctor";
  const allowTreatmentUpdates = profile?.role !== "receptionist";
  const contentPadding = {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 16,
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 0);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (scrollToTopKey === undefined) return;

    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 0);

    return () => clearTimeout(timeout);
  }, [scrollToTopKey]);

  const content = (
    <>
      {children}
      {isDashboard && profile?.clinic_id ? (
        <OngoingTreatmentsSection
          allowStatusUpdates={allowTreatmentUpdates}
          doctorOnly={doctorOnly}
        />
      ) : null}
    </>
  );

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
            {content}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.background, ...contentPadding }}>
            {content}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
