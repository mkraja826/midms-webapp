import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { AuthProvider, useAuth } from "@/lib/auth";
import { colors } from "@/constants/colors";
import { isSupabaseConfigured } from "@/lib/supabase";

const appLogo = require("../../assets/icon.png");

function ConfigurationErrorScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        backgroundColor: colors.background,
        padding: 24,
        gap: 12,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>
        Supabase is not configured
      </Text>
      <Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>
        Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.
      </Text>
    </View>
  );
}

function RootStack() {
  const { loading, loadingMessage } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar style="dark" />

        <View style={styles.logoCard}>
          <Image source={appLogo} style={styles.loadingLogo} resizeMode="contain" />
        </View>

        <Text style={styles.loadingTitle}>MiDMS</Text>
        <Text style={styles.loadingSubtitle}>Dental Management System</Text>

        <View style={styles.loadingStatus}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingMessage}>
            {loadingMessage || "Preparing your dental workspace..."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="auth/callback" options={{ headerShown: true, title: "Verifying Email" }} />
        <Stack.Screen name="auth/forgot-password" options={{ headerShown: true, title: "Forgot Password" }} />
        <Stack.Screen name="auth/reset-password" options={{ headerShown: true, title: "Reset Password" }} />
        <Stack.Screen name="settings/change-password" options={{ headerShown: true, title: "Change Password" }} />
        <Stack.Screen name="settings/subscription" options={{ headerShown: true, title: "Subscription" }} />
        <Stack.Screen name="clinic/contact-admin" options={{ headerShown: true, title: "Contact Owner" }} />
        <Stack.Screen name="patient/payment" options={{ headerShown: true, title: "Collect Payment" }} />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: true,
            title: "Clinic Setup",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="payment/fee" options={{ headerShown: true, title: "Reception Fees" }} />
        <Stack.Screen name="payment/op-fee" options={{ headerShown: true, title: "OP Fee" }} />
        <Stack.Screen name="payment/medication-fee" options={{ headerShown: true, title: "Medication Fee" }} />
        <Stack.Screen name="image-viewer" />
        <Stack.Screen name="(head)" />
        <Stack.Screen name="(doctor)" />
        <Stack.Screen name="(reception)" />

        {/* Existing patient/staff routes can stay. These lines keep old screens reachable if present. */}
        <Stack.Screen name="patient/add" options={{ headerShown: true, title: "Add Patient" }} />
        <Stack.Screen name="patient/add-old" options={{ headerShown: true, title: "Add Old Patient" }} />
        <Stack.Screen name="patient/edit" options={{ headerShown: true, title: "Edit Patient" }} />
        <Stack.Screen name="patient/[id]" options={{ headerShown: true, title: "Patient Profile" }} />
        <Stack.Screen name="patient/visit" options={{ headerShown: true, title: "Add Visit" }} />
        <Stack.Screen name="patient/upload-prescription" options={{ headerShown: true, title: "Upload Prescription" }} />
        <Stack.Screen name="patient/upload-xray" options={{ headerShown: true, title: "Upload X-ray" }} />
        <Stack.Screen name="patient/upload-photo" options={{ headerShown: true, title: "Upload Patient Photo" }} />
        <Stack.Screen name="staff/index" options={{ headerShown: true, title: "Staff Management" }} />
        <Stack.Screen name="staff/add" options={{ headerShown: true, title: "Add Staff" }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 28,
  },
  logoCard: {
    width: 164,
    height: 164,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  loadingLogo: {
    width: 132,
    height: 132,
    borderRadius: 30,
  },
  loadingTitle: {
    marginTop: 26,
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  loadingSubtitle: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  loadingStatus: {
    marginTop: 34,
    alignItems: "center",
    gap: 12,
  },
  loadingMessage: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});

export default function Layout() {
  if (!isSupabaseConfigured) {
    return <ConfigurationErrorScreen />;
  }

  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}
