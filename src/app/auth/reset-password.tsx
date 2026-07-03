import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

function paramsFromUrl(url: string) {
  const [, query = ""] = url.split("?");
  const [, hash = ""] = url.split("#");
  return new URLSearchParams(query || hash);
}

async function applyAuthLink(url: string | null) {
  if (!url) return;

  const params = paramsFromUrl(url);
  const code = params.get("code");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return;
  }

  if (accessToken && refreshToken) {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }
}

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Linking.getInitialURL().then(applyAuthLink).catch(() => undefined);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      applyAuthLink(url).catch(() => undefined);
    });

    return () => subscription.remove();
  }, []);

  async function submit() {
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Enter the same new password twice.");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      Alert.alert("Password updated", "Login with your new password.", [
        { text: "Login", onPress: () => router.replace("/login" as never) },
      ]);
    } catch (error) {
      Alert.alert("Reset failed", error instanceof Error ? error.message : "Open the latest reset link and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Reset Password
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Set a new password for this DMS account.
        </Text>
      </View>

      <SectionCard title="New Password">
        <AppInput
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Minimum 6 characters"
        />
        <AppInput
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Repeat password"
        />
        <AppButton title="Update Password" icon="key-outline" onPress={submit} loading={loading} />
      </SectionCard>
    </Screen>
  );
}
