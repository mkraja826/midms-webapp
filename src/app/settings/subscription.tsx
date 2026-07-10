import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/supabase";
import {
  ClinicSubscription,
  getClinicSubscription,
  getSubscriptionAccess,
  getSubscriptionDisplay,
} from "@/lib/subscription";

type BillingPlan = "monthly" | "yearly";

const MONTHLY_AMOUNT = 799;
const YEARLY_AMOUNT = MONTHLY_AMOUNT * 12;

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function PlanOption({
  active,
  title,
  subtitle,
  price,
  badge,
  onPress,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  price: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 126,
        borderRadius: 24,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primarySoft : colors.background,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 15,
            backgroundColor: active ? colors.primary : colors.surface,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: active ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons
            name={active ? "checkmark-outline" : "ellipse-outline"}
            size={22}
            color={active ? colors.white : colors.muted}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
            {title}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>

        {badge ? <StatusBadge label={badge} tone="success" /> : null}
      </View>

      <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
        {price}
      </Text>
    </Pressable>
  );
}

function FeatureRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 13,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={{ flex: 1, color: colors.text, fontWeight: "800" }}>
        {label}
      </Text>
    </View>
  );
}

export default function SubscriptionScreen() {
  const params = useLocalSearchParams<{ locked?: string }>();
  const { profile } = useAuth();
  const [plan, setPlan] = useState<BillingPlan>("monthly");
  const [subscription, setSubscription] = useState<ClinicSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const locked = params.locked === "1";
  const subscriptionInfo = getSubscriptionDisplay(subscription);
  const access = getSubscriptionAccess(subscription);

  const summary = useMemo(() => {
    if (plan === "monthly") {
      return {
        title: "Monthly billing",
        amount: money(MONTHLY_AMOUNT),
        note: "Billed every month after activation",
      };
    }

    return {
      title: "Yearly billing",
      amount: money(YEARLY_AMOUNT),
      note: `${money(MONTHLY_AMOUNT)} per month, billed yearly`,
    };
  }, [plan]);

  async function load() {
    try {
      setLoading(true);
      const data = await getClinicSubscription();
      setSubscription(data);
    } catch (error) {
      Alert.alert("Subscription load failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile?.clinic_id]);

  function goDashboard() {
    if (profile?.role) {
      router.replace(getDashboardPath(profile.role) as never);
      return;
    }

    router.replace("/" as never);
  }

  function requestActivation() {
    Alert.alert(
      access.blocked ? "Renewal request ready" : "Plan activation request ready",
      `${summary.title} selected for ${profile?.name ?? "this clinic"}.\n\nAmount: ${summary.amount}\n\nPayment gateway is not connected yet. Owner/admin must confirm collection manually, then update subscription status in Supabase.`
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Subscription
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Review clinic trial, renewal status, and plan activation before enabling live billing.
        </Text>
      </View>

      {locked || access.blocked ? (
        <SectionCard title="Clinic Access Paused" subtitle="Renewal is required before staff can continue normal clinic work.">
          <View
            style={{
              borderRadius: 22,
              padding: 14,
              backgroundColor: colors.dangerSoft,
              borderWidth: 1,
              borderColor: "#FECACA",
              gap: 10,
            }}
          >
            <StatusBadge label={access.statusLabel} tone="danger" />
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
              {subscriptionInfo.title}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 21 }}>
              {access.reason}
            </Text>
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Current Status" subtitle="Live status from clinic subscription settings.">
        <View
          style={{
            borderRadius: 26,
            padding: 16,
            gap: 14,
            backgroundColor:
              subscriptionInfo.tone === "danger"
                ? colors.dangerSoft
                : subscriptionInfo.tone === "warning"
                ? colors.warningSoft
                : colors.successSoft,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 18,
                backgroundColor: colors.white,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="shield-checkmark-outline" size={25} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: "900" }}>
                {loading ? "Checking plan..." : subscriptionInfo.title}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 20 }}>
                {loading ? "Loading subscription status." : subscriptionInfo.subtitle}
              </Text>
            </View>
            <StatusBadge label={access.statusLabel} tone={subscriptionInfo.tone} />
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Choose Billing" subtitle="Select monthly or yearly billing before requesting activation or renewal.">
        <PlanOption
          active={plan === "monthly"}
          title="Monthly"
          subtitle="Flexible clinic billing"
          price={`${money(MONTHLY_AMOUNT)} / month`}
          onPress={() => setPlan("monthly")}
        />

        <PlanOption
          active={plan === "yearly"}
          title="Yearly"
          subtitle="One annual payment"
          price={`${money(YEARLY_AMOUNT)} / year`}
          badge="12 months"
          onPress={() => setPlan("yearly")}
        />
      </SectionCard>

      <SectionCard title="Included" subtitle="Core clinic tools covered under the selected MiDMS plan.">
        <FeatureRow icon="people-outline" label="Unlimited patient search and clinical history" />
        <FeatureRow icon="cloud-upload-outline" label="Photo, prescription, report and X-ray uploads" />
        <FeatureRow icon="cash-outline" label="OP, X-ray, medication and pending payment tracking" />
        <FeatureRow icon="notifications-outline" label="Follow-up and payment reminder workflow" />
        <FeatureRow icon="lock-closed-outline" label="Role-based access for owner, doctor and reception" />
      </SectionCard>

      <SectionCard title="Billing Summary" subtitle="Review selected billing cycle and amount before request.">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
              {summary.title}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 3 }}>
              {summary.note}
            </Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
            {summary.amount}
          </Text>
        </View>
      </SectionCard>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton
          title={access.blocked ? "Refresh Status" : "Dashboard"}
          icon={access.blocked ? "refresh-outline" : "home-outline"}
          variant="secondary"
          onPress={access.blocked ? load : goDashboard}
          loading={loading}
          style={{ flex: 1 }}
        />
        <AppButton
          title={access.blocked ? "Request Renewal" : "Request Activation"}
          icon="card-outline"
          onPress={requestActivation}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}
