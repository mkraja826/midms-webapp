import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { getDashboardPath, getRoleLabel } from "@/lib/supabase";

const SUPPORT_EMAIL = "karthikraja826@gmail.com";

type IssueCategory = "bug" | "payment" | "upload" | "login" | "suggestion" | "other";

const ISSUE_CATEGORIES: { key: IssueCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "bug", label: "Bug", icon: "bug-outline" },
  { key: "payment", label: "Payment", icon: "wallet-outline" },
  { key: "upload", label: "Upload", icon: "cloud-upload-outline" },
  { key: "login", label: "Login", icon: "lock-closed-outline" },
  { key: "suggestion", label: "Suggestion", icon: "bulb-outline" },
  { key: "other", label: "Other", icon: "help-circle-outline" },
];

function buildMailUrl(input: { subject: string; body: string }) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(input.subject)}&body=${encodeURIComponent(input.body)}`;
}

function supportNowLabel() {
  return new Date().toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportIssueScreen() {
  const { profile, session } = useAuth();
  const [category, setCategory] = useState<IssueCategory>("bug");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);

  const categoryLabel = ISSUE_CATEGORIES.find((item) => item.key === category)?.label ?? "Issue";
  const appVersion = Constants.expoConfig?.version ?? "unknown";
  const userEmail = profile?.email || session?.user?.email || "not available";
  const homePath = getDashboardPath(profile?.role ?? "receptionist");

  const supportMessage = useMemo(() => {
    return [
      "CapDent Support Request",
      "",
      `Issue Type: ${categoryLabel}`,
      `Reported At: ${supportNowLabel()}`,
      "",
      "Clinic / User Details",
      `Clinic ID: ${profile?.clinic_id || "not available"}`,
      `User ID: ${profile?.id || "not available"}`,
      `Name: ${profile?.name || "not available"}`,
      `Email: ${userEmail}`,
      `Role: ${profile?.role ? getRoleLabel(profile.role) : "not available"}`,
      "",
      "App Details",
      `App Version: ${appVersion}`,
      `Platform: ${Platform.OS}`,
      "",
      "Issue Details",
      description.trim() || "Please describe the issue here.",
    ].join("\n");
  }, [appVersion, categoryLabel, description, profile?.clinic_id, profile?.id, profile?.name, profile?.role, userEmail]);

  async function sendSupportEmail() {
    if (!description.trim()) {
      Alert.alert("Issue details required", "Write what happened before sending support request.");
      return;
    }

    try {
      setSending(true);
      const subject = `CapDent Support - ${categoryLabel}${profile?.clinic_id ? ` - ${profile.clinic_id}` : ""}`;
      const url = buildMailUrl({ subject, body: supportMessage });
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Email app not available",
        "Please copy the support details shown below and send them to support manually."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Report Issue
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Send a clean support request with clinic ID, user role, app version, and issue details.
        </Text>
      </View>

      <SectionCard title="Support Contact" subtitle="Use this for bugs, payment issues, upload problems, login help, or feature suggestions.">
        <View style={{ gap: 10 }}>
          <View
            style={{
              padding: 14,
              borderRadius: 20,
              backgroundColor: colors.primarySoft,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 6,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              CapDent Support
            </Text>
            <Text selectable style={{ color: colors.primary, fontWeight: "900" }}>
              {SUPPORT_EMAIL}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              The email will include clinic and app details automatically so support can understand the issue faster.
            </Text>
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Issue Type" subtitle="Choose the closest category.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {ISSUE_CATEGORIES.map((item) => {
            const selected = category === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => setCategory(item.key)}
                style={{
                  minHeight: 42,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : colors.background,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons name={item.icon} size={16} color={selected ? colors.white : colors.primary} />
                <Text style={{ color: selected ? colors.white : colors.text, fontWeight: "900", fontSize: 13 }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="What happened?" subtitle="Write simple steps. Example: Patient profile → upload X-ray → app showed error.">
        <View
          style={{
            minHeight: 150,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue, screen name, and what you expected."
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            style={{
              minHeight: 130,
              color: colors.text,
              fontSize: 16,
              lineHeight: 22,
            }}
          />
        </View>

        <AppButton
          title="Send Support Email"
          icon="mail-outline"
          onPress={() => {
            void sendSupportEmail();
          }}
          loading={sending}
        />
      </SectionCard>

      <SectionCard title="Support Details Preview" subtitle="This text is safe to copy and send manually if email does not open.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <StatusBadge label={categoryLabel} tone="warning" />
          <StatusBadge label={`v${appVersion}`} />
          <StatusBadge label={Platform.OS} tone="success" />
        </View>

        <Text selectable style={{ color: colors.muted, lineHeight: 20 }}>
          {supportMessage}
        </Text>
      </SectionCard>

      <AppButton
        title="Back to Dashboard"
        icon="arrow-back-outline"
        variant="ghost"
        onPress={() => router.replace(homePath as never)}
      />
    </Screen>
  );
}
