import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const { signIn, signUpOwner } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing details", "Enter email and password.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUpOwner(email, password);
        Alert.alert(
          "Verify your email",
          "We sent a verification link. Verify your email, then return to CapDent and sign in."
        );
        setMode("login");
        setPassword("");
      }
    } catch (error) {
      Alert.alert(
        mode === "login" ? "Login failed" : "Signup failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: Platform.OS === "web" ? 32 : 22,
        }}
      >
        <View style={{ width: "100%", maxWidth: 480, gap: 24 }}>
          <View style={{ alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 78,
                height: 78,
                borderRadius: 26,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: colors.primary,
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 4,
              }}
            >
              <Ionicons name="medical-outline" color={colors.white} size={40} />
            </View>

            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900" }}>
              CAPDENT
            </Text>

            <Text
              style={{
                color: colors.text,
                fontSize: 32,
                fontWeight: "900",
                textAlign: "center",
              }}
            >
              {mode === "login" ? "Clinic Login" : "Create Owner Account"}
            </Text>

            <Text
              style={{
                color: colors.muted,
                fontSize: 16,
                textAlign: "center",
                lineHeight: 22,
                maxWidth: 390,
              }}
            >
              {mode === "login"
                ? "Access your clinic workspace from any modern browser."
                : "Create the first owner account and set up your clinic workspace."}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 30,
              padding: Platform.OS === "web" ? 24 : 18,
              gap: 14,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <AppInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="doctor@clinic.com"
            />

            <AppInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Minimum 6 characters"
            />

            <AppButton
              title={mode === "login" ? "Login" : "Create Account"}
              icon={mode === "login" ? "log-in-outline" : "person-add-outline"}
              onPress={submit}
              loading={loading}
            />

            <AppButton
              title={mode === "login" ? "Create owner account" : "Back to login"}
              icon={mode === "login" ? "person-add-outline" : "arrow-back-outline"}
              variant="secondary"
              onPress={() => {
                setMode(mode === "login" ? "signup" : "login");
                setPassword("");
              }}
            />

            {mode === "login" ? (
              <Pressable
                onPress={() => router.push("/auth/forgot-password" as never)}
                style={{ alignItems: "center", padding: 8 }}
              >
                <Text style={{ color: colors.primary, fontWeight: "900" }}>
                  Forgot password?
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", lineHeight: 18 }}>
            Owner · Doctor · Receptionist access
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
