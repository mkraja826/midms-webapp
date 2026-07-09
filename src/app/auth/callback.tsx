import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ActivityIndicator, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";

function paramsFromUrl(url: string) {
  const queryIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#");
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : "";
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
  const params = new URLSearchParams(query);

  new URLSearchParams(hash).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });

  return params;
}

async function completeAuthCallback(url: string) {
  const params = paramsFromUrl(url);
  const code = params.get("code");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const errorDescription = params.get("error_description") || params.get("error");

  if (errorDescription) {
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;
    return;
  }
}

export default function AuthCallbackScreen() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function handleCallback() {
      try {
        const { data } = await supabase.auth.getSession();

        if (!data.session) {
          const currentUrl = window?.location?.href;
          if (currentUrl) {
            await completeAuthCallback(currentUrl);
          }
        }

        if (!mounted) return;

        Alert.alert("Email verified", "Your email is verified. Please login to continue.", [
          { text: "Login", onPress: () => router.replace("/login" as never) },
        ]);
      } catch (error) {
        if (!mounted) return;

        setFailed(true);
        Alert.alert(
          "Verification failed",
          error instanceof Error ? error.message : "Open the latest verification email and try again."
        );
      }
    }

    handleCallback();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Screen>
      <View style={{ alignItems: "center", justifyContent: "center", gap: 14, flex: 1 }}>
        {!failed ? <ActivityIndicator color={colors.primary} /> : null}
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", textAlign: "center" }}>
          {failed ? "Verification failed" : "Verifying email..."}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }}>
          {failed
            ? "Please open the latest email verification link again."
            : "Please wait while DMS confirms your account."}
        </Text>
        {failed ? (
          <AppButton title="Back to Login" icon="arrow-back-outline" onPress={() => router.replace("/login" as never)} />
        ) : null}
      </View>
    </Screen>
  );
}
