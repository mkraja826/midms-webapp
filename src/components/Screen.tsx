import { ReactNode, useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
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
      {isDashboard && profile?.clinic_id ? <OngoingTreatmentsShortcut /> : null}
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

function OngoingTreatmentsShortcut() {
  return (
    <Pressable
      onPress={() => router.push("/treatments/ongoing" as never)}
      style={({ pressed }) => ({
        borderRadius: 20,
        padding: 14,
        minHeight: 92,
        backgroundColor: pressed ? colors.surfaceSoft : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="construct-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Ongoing Treatments</Text>
        <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 18 }} numberOfLines={2}>
          Open planned, ongoing, paid and outstanding treatments.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}
