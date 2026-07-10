import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/supabase";
import {
  formatSubscriptionDateTime,
  getClinicSubscription,
  getSubscriptionAccess,
  getSubscriptionDisplay,
  getSubscriptionPaymentRequests,
  requestSubscriptionPayment,
  SUBSCRIPTION_MONTHLY_AMOUNT,
  SUBSCRIPTION_YEARLY_AMOUNT,
  subscriptionBillingLabel,
  subscriptionPaymentStatusLabel,
  subscriptionPaymentStatusTone,
} from "@/lib/subscription";
import type {
  ClinicSubscription,
  SubscriptionBillingCycle,
  SubscriptionPaymentRequest,
} from "@/lib/subscription";

const MONTHLY_AMOUNT = SUBSCRIPTION_MONTHLY_AMOUNT;
const YEARLY_AMOUNT = SUBSCRIPTION_YEARLY_AMOUNT;

function money(value: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
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
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>{title}</Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>{subtitle}</Text>
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
      <Text style={{ flex: 1, color: colors.text, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

function PaymentRequestCard({ request }: { request: SubscriptionPaymentRequest }) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 15,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="receipt-outline" size={20} color={colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            {subscriptionBillingLabel(request.billing_cycle)} • {money(Number(request.amount || 0))}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
            Requested {formatSubscriptionDateTime(request.requested_at)}
          </Text>
        </View>

        <StatusBadge label={subscriptionPaymentStatusLabel(request.status)} tone={subscriptionPaymentStatusTone(request.status)} />
      </View>

      {request.payment_reference ? (
        <Text style={{ color: colors.text, fontWeight: "800" }}>
          Reference: <Text style={{ color: colors.muted }}>{request.payment_reference}</Text>
        </Text>
      ) : null}

      {request.owner_note ? <Text style={{ color: colors.muted, lineHeight: 19 }}>{request.owner_note}</Text> : null}
      {request.admin_note ? <Text style={{ color: colors.muted, lineHeight: 19 }}>Admin note: {request.admin_note}</Text> : null}
    </View>
  );
}

export default function SubscriptionScreen() {
  const params = useLocalSearchParams<{ locked?: string }>();
  const { profile } = useAuth();
  const [plan, setPlan] = useState<SubscriptionBillingCycle>("monthly");
  const [subscription, setSubscription] = useState<ClinicSubscription | null>(null);
  const [paymentRequests, setPaymentRequests] = useState<SubscriptionPaymentRequest[]>([]);
  const [paymentReference, setPaymentReference] = useState("");
  const [ownerNote, setOwnerNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const locked = params.locked === "1";
  const subscriptionInfo = getSubscriptionDisplay(subscription);
  const access = getSubscriptionAccess(subscription);
  const latestPendingRequest = paymentRequests.find((request) => request.status === "pending_review") || null;

  const summary = useMemo(() => {
    if (plan === "monthly") {
      return {
        title: "Monthly billing",
        amount: money(MONTHLY_AMOUNT),
        note: "One month access after payment approval",
      };
    }

    return {
      title: "Yearly billing",
      amount: money(YEARLY_AMOUNT),
      note: `${money(MONTHLY_AMOUNT)} per month, 12 months access after approval`,
    };
  }, [plan]);

  async function load() {
    try {
      setLoading(true);
      const [subscriptionData, paymentRows] = await Promise.all([
        getClinicSubscription(),
        getSubscriptionPaymentRequests(5),
      ]);
      setSubscription(subscriptionData);
      setPaymentRequests(paymentRows);
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

  async function submitPaymentRequest() {
    if (!profile?.clinic_id) {
      Alert.alert("Clinic missing", "Clinic profile was not loaded. Please sign in again.");
      return;
    }

    try {
      setSubmittingPayment(true);
      const request = await requestSubscriptionPayment({
        billingCycle: plan,
        paymentReference,
        ownerNote,
      });

      setPaymentReference("");
      setOwnerNote("");
      await load();

      Alert.alert(
        "Payment request submitted",
        `${subscriptionBillingLabel(request.billing_cycle)} plan request for ${money(Number(request.amount || 0))} is pending MiDMS admin approval. No referral credit or discount is applied.`
      );
    } catch (error) {
      Alert.alert("Payment request failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSubmittingPayment(false);
    }
  }

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>Subscription</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Review clinic trial, payment request status, and renewal before enabling live billing.
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
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{subscriptionInfo.title}</Text>
            <Text style={{ color: colors.muted, lineHeight: 21 }}>{access.reason}</Text>
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

      <SectionCard title="Choose Billing" subtitle="Select monthly or yearly billing before submitting payment request.">
        <PlanOption
          active={plan === "monthly"}
          title="Monthly"
          subtitle="One month access"
          price={`${money(MONTHLY_AMOUNT)} / month`}
          onPress={() => setPlan("monthly")}
        />

        <PlanOption
          active={plan === "yearly"}
          title="Yearly"
          subtitle="Twelve months access"
          price={`${money(YEARLY_AMOUNT)} / year`}
          badge="12 months"
          onPress={() => setPlan("yearly")}
        />
      </SectionCard>

      <SectionCard title="Payment Handling" subtitle="Manual payment record. No referral program, credits, or discount logic is applied.">
        <View
          style={{
            padding: 14,
            borderRadius: 20,
            backgroundColor: colors.warningSoft,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="information-circle-outline" size={22} color={colors.warning} />
            <Text style={{ flex: 1, color: colors.text, fontWeight: "900" }}>
              Manual approval flow
            </Text>
          </View>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            Owner submits payment reference after UPI/cash/bank collection. MiDMS admin verifies it, then approves the request from Supabase to activate the clinic period.
          </Text>
        </View>

        {latestPendingRequest ? (
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
            <StatusBadge label="Pending payment already submitted" tone="warning" />
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              {subscriptionBillingLabel(latestPendingRequest.billing_cycle)} • {money(Number(latestPendingRequest.amount || 0))}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              Submitting again will update the existing pending request instead of creating a duplicate.
            </Text>
          </View>
        ) : null}

        <AppInput
          label="Payment reference / UTR / receipt number"
          value={paymentReference}
          onChangeText={setPaymentReference}
          placeholder="Optional but recommended"
          autoCapitalize="characters"
          helper="Use UPI UTR, cash receipt number, or bank transfer reference."
        />

        <AppInput
          label="Owner note"
          value={ownerNote}
          onChangeText={setOwnerNote}
          placeholder="Example: Paid by UPI from clinic account"
          multiline
          helper="This note is visible in the payment request history."
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
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>{summary.title}</Text>
            <Text style={{ color: colors.muted, marginTop: 3 }}>{summary.note}</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
            {summary.amount}
          </Text>
        </View>
      </SectionCard>

      <SectionCard title="Payment Request History" subtitle="Recent subscription payment requests for this clinic only.">
        {paymentRequests.length ? (
          <View style={{ gap: 10 }}>
            {paymentRequests.map((request) => (
              <PaymentRequestCard key={request.id} request={request} />
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            No payment requests submitted yet.
          </Text>
        )}
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
          title={access.blocked ? "Submit Renewal" : "Submit Payment"}
          icon="card-outline"
          onPress={submitPaymentRequest}
          loading={submittingPayment}
          loadingTitle="Submitting..."
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}
