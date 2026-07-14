import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Platform, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import {
  addGooglePlayPurchaseListeners,
  endGooglePlayBilling,
  finishGooglePlaySubscriptionPurchase,
  GOOGLE_PLAY_INTELLIGENCE_PRODUCT_ID,
  GOOGLE_PLAY_PLAN_DETAILS,
  GOOGLE_PLAY_PROFESSIONAL_PRODUCT_ID,
  googlePlayBillingUnavailableReason,
  GooglePlayBillingPlan,
  GooglePlayPlanKey,
  launchGooglePlaySubscriptionPurchase,
  loadGooglePlayBillingPlans,
  recordGooglePlaySubscriptionPurchase,
} from "@/lib/googlePlayBilling";
import { useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/supabase";
import {
  getClinicPlanLabel,
  getClinicPlanName,
  getClinicSubscription,
  getSubscriptionAccess,
  getSubscriptionDisplay,
  hasGooglePlayAutopay,
} from "@/lib/subscription";
import type { ClinicPlanName, ClinicSubscription } from "@/lib/subscription";

const RUPEE = "\u20B9";
const PAID_PLAN_ORDER: GooglePlayPlanKey[] = ["professional", "clinic_intelligence"];

function money(value: number) {
  return `${RUPEE}${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
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

function currentBadgeTone(isCurrent: boolean, planKey: GooglePlayPlanKey) {
  if (isCurrent) return "success" as const;
  return planKey === "clinic_intelligence" ? ("warning" as const) : ("primary" as const);
}

function FreePlanCard({ currentPlan }: { currentPlan: ClinicPlanName }) {
  const isCurrent = currentPlan === "free";

  return (
    <View
      style={{
        borderRadius: 22,
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: isCurrent ? colors.primary : colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 17,
            backgroundColor: colors.successSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="shield-checkmark-outline" size={24} color={colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>Free</Text>
          <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 20 }}>
            For a new single-owner clinic to start clean without costly software.
          </Text>
        </View>
        <StatusBadge label={isCurrent ? "Current" : "Included"} tone={isCurrent ? "success" : "primary"} />
      </View>

      <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
        Free
      </Text>
    </View>
  );
}

function GooglePlayPlanCard({
  planKey,
  plan,
  isCurrent,
  loading,
  onPress,
}: {
  planKey: GooglePlayPlanKey;
  plan: GooglePlayBillingPlan | null;
  isCurrent: boolean;
  loading: boolean;
  onPress: () => void;
}) {
  const details = GOOGLE_PLAY_PLAN_DETAILS[planKey];
  const isIntelligence = planKey === "clinic_intelligence";
  const price = plan?.displayPrice || `${money(details.monthlyAmount)}/month`;
  const professionalTrialMissing = planKey === "professional" && Boolean(plan && (!plan.hasTrialOffer || !plan.offerToken));
  const disabled = isCurrent || loading || Platform.OS !== "android" || professionalTrialMissing;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        borderRadius: 22,
        padding: 16,
        gap: 14,
        borderWidth: 1,
        borderColor: isCurrent ? colors.success : isIntelligence ? colors.warning : colors.primary,
        backgroundColor: isIntelligence ? colors.warningSoft : colors.primarySoft,
        opacity: disabled ? 0.85 : pressed ? 0.78 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            backgroundColor: isIntelligence ? colors.warning : colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={isIntelligence ? "analytics-outline" : "logo-google-playstore"} size={25} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: "900" }}>
            {plan?.title || details.name}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 20 }}>
            {plan?.description || details.description}
          </Text>
        </View>
        <StatusBadge label={isCurrent ? "Current" : details.badge} tone={currentBadgeTone(isCurrent, planKey)} />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
          {price}
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 20 }}>
          {planKey === "professional"
            ? "3 months free through Google Play. Payment method required. Auto-renews at \u20B9799/month after trial. Cancel anytime."
            : "Monthly auto-renewal through Google Play. The owner can cancel anytime in Play Store."}
        </Text>
        {professionalTrialMissing ? (
          <Text style={{ color: colors.warning, fontWeight: "900", lineHeight: 20 }}>
            Professional trial offer was not returned by Google Play. Check the trial offer in Play Console.
          </Text>
        ) : null}
      </View>

      <AppButton
        title={
          isCurrent
            ? "Current Plan"
            : professionalTrialMissing
            ? "Trial Setup Needed"
            : planKey === "professional"
            ? "Start 3-Month Free Trial"
            : `Subscribe ${getClinicPlanLabel(planKey)}`
        }
        icon={isCurrent ? "checkmark-circle-outline" : "logo-google-playstore"}
        onPress={onPress}
        loading={loading}
        loadingTitle="Opening Google Play..."
        disabled={disabled}
      />
    </Pressable>
  );
}

export default function SubscriptionScreen() {
  const params = useLocalSearchParams<{ locked?: string }>();
  const { profile } = useAuth();
  const [subscription, setSubscription] = useState<ClinicSubscription | null>(null);
  const [billingPlans, setBillingPlans] = useState<GooglePlayBillingPlan[]>([]);
  const [billingError, setBillingError] = useState<string | null>(googlePlayBillingUnavailableReason());
  const [loading, setLoading] = useState(true);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [startingPlan, setStartingPlan] = useState<GooglePlayPlanKey | null>(null);

  const locked = params.locked === "1";
  const subscriptionInfo = getSubscriptionDisplay(subscription);
  const access = getSubscriptionAccess(subscription);
  const currentPlan = getClinicPlanName(subscription);
  const googlePlayLinked = hasGooglePlayAutopay(subscription);
  const currentProductId = googlePlayLinked ? subscription?.google_play_product_id || null : null;
  const paidPlanActive =
    currentPlan !== "free" &&
    googlePlayLinked &&
    subscription?.status === "active" &&
    subscription?.google_play_status !== "cancelled" &&
    subscription?.google_play_status !== "expired";

  async function load() {
    try {
      setLoading(true);
      const subscriptionData = await getClinicSubscription();
      setSubscription(subscriptionData);
    } catch (error) {
      Alert.alert("Subscription load failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadBillingPlans() {
    if (Platform.OS !== "android") {
      setBillingError("Google Play Billing works only inside the Android app installed from Play testing/production.");
      return [] as GooglePlayBillingPlan[];
    }

    try {
      setLoadingBilling(true);
      setBillingError(null);
      const plans = await loadGooglePlayBillingPlans();
      setBillingPlans(plans);

      const foundIds = new Set(plans.map((plan) => plan.productId));
      const missing = [GOOGLE_PLAY_PROFESSIONAL_PRODUCT_ID, GOOGLE_PLAY_INTELLIGENCE_PRODUCT_ID].filter(
        (productId) => !foundIds.has(productId)
      );

      if (missing.length) {
        setBillingError(`Google Play product not found or inactive: ${missing.join(", ")}.`);
      }

      const professionalPlan = plans.find((plan) => plan.key === "professional");
      if (professionalPlan && (!professionalPlan.hasTrialOffer || !professionalPlan.offerToken)) {
        setBillingError("Professional 3-month free trial offer was not returned by Google Play.");
      }

      return plans;
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Google Play Billing could not load subscription plans.");
      return [] as GooglePlayBillingPlan[];
    } finally {
      setLoadingBilling(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile?.clinic_id]);

  useEffect(() => {
    loadBillingPlans();

    const cleanup = addGooglePlayPurchaseListeners({
      onPurchase: async (purchase) => {
        try {
          const updatedSubscription = (await recordGooglePlaySubscriptionPurchase(purchase)) as ClinicSubscription;
          await finishGooglePlaySubscriptionPurchase(purchase);
          setSubscription(updatedSubscription);
          await load();

          const planLabel = getClinicPlanLabel(getClinicPlanName(updatedSubscription));
          Alert.alert(
            `${planLabel} active`,
            `CapDent ${planLabel} is linked to Google Play monthly auto-renewal. Core Free access remains available if the owner cancels.`
          );
        } catch (error) {
          Alert.alert("Subscription save failed", error instanceof Error ? error.message : "Please try again.");
        } finally {
          setStartingPlan(null);
        }
      },
      onError: (message) => {
        setStartingPlan(null);
        Alert.alert("Google Play Billing", message);
      },
    });

    return () => {
      cleanup();
      endGooglePlayBilling();
    };
  }, [profile?.clinic_id]);

  function goDashboard() {
    if (profile?.role) {
      router.replace(getDashboardPath(profile.role) as never);
      return;
    }

    router.replace("/" as never);
  }

  async function startGooglePlaySubscription(planKey: GooglePlayPlanKey) {
    try {
      setStartingPlan(planKey);

      let plans = billingPlans;
      if (!plans.length) {
        plans = await loadBillingPlans();
      }

      const plan = plans.find((item) => item.key === planKey);
      if (!plan) {
        throw new Error(`Google Play product ${GOOGLE_PLAY_PLAN_DETAILS[planKey].productId} was not returned.`);
      }

      await launchGooglePlaySubscriptionPurchase(plan, { currentProductId });
    } catch (error) {
      setStartingPlan(null);
      Alert.alert("Google Play subscription failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  function planFor(key: GooglePlayPlanKey) {
    return billingPlans.find((plan) => plan.key === key) || null;
  }

  async function openGooglePlaySubscriptions() {
    if (Platform.OS !== "android") {
      Alert.alert("Google Play", "Open Google Play Store > Payments & subscriptions > Subscriptions to cancel this plan.");
      return;
    }

    try {
      await Linking.openURL("https://play.google.com/store/account/subscriptions");
    } catch {
      Alert.alert("Google Play", "Open Google Play Store > Payments & subscriptions > Subscriptions to cancel this plan.");
    }
  }

  return (
    <Screen refreshing={loading || loadingBilling} onRefresh={() => { load(); loadBillingPlans(); }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          {paidPlanActive ? "Subscription" : "Plans"}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          {paidPlanActive
            ? "Your paid plan is active. Manage cancellation through Google Play only."
            : "Start professionally on Free. Grow without limits on Professional. Understand the clinic deeply with Intelligence."}
        </Text>
      </View>

      {locked || access.blocked ? (
        <SectionCard title="Clinic Access" subtitle="Core clinic access remains available on the Free plan.">
          <View
            style={{
              borderRadius: 22,
              padding: 14,
              backgroundColor: colors.warningSoft,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 10,
            }}
          >
            <StatusBadge label={access.statusLabel} tone="warning" />
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>{subscriptionInfo.title}</Text>
            <Text style={{ color: colors.muted, lineHeight: 21 }}>{access.reason}</Text>
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Current Plan" subtitle="Live status from clinic subscription settings.">
        <View
          style={{
            borderRadius: 22,
            padding: 16,
            gap: 14,
            backgroundColor:
              subscriptionInfo.tone === "warning"
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
              <Ionicons
                name={googlePlayLinked ? "logo-google-playstore" : "shield-checkmark-outline"}
                size={25}
                color={colors.primary}
              />
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

      {paidPlanActive ? (
        <SectionCard title="Manage Plan" subtitle="Paid access is active. Plan choices stay hidden until this plan is cancelled.">
          <FeatureRow
            icon="checkmark-circle-outline"
            label={`${getClinicPlanLabel(currentPlan)} is active through Google Play auto-renewal.`}
          />
          <FeatureRow
            icon="logo-google-playstore"
            label="Cancel anytime in Google Play Store. CapDent will show plans again after Play reports cancellation."
          />
          <AppButton
            title="Cancel Plan in Play Store"
            icon="logo-google-playstore"
            variant="secondary"
            onPress={openGooglePlaySubscriptions}
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Plan Map" subtitle="What each level means inside CapDent.">
            <FeatureRow
              icon="shield-checkmark-outline"
              label="Free: for new single-owner clinics with one trusted staff member, basic records, visits, payments, and reports."
            />
            <FeatureRow
              icon="briefcase-outline"
              label="Professional: start with 3 months free, then \u20B9799/month for unlimited core clinic work."
            />
            <FeatureRow
              icon="analytics-outline"
              label="Clinic Intelligence: \u20B91500/month for proprietary owner dashboard, Smile Gallery, and growth insights."
            />
          </SectionCard>

          <SectionCard title="Choose Plan" subtitle="Professional starts with 3 months free. Google Play payment method is required.">
            <FreePlanCard currentPlan={currentPlan} />

            {PAID_PLAN_ORDER.map((planKey) => (
              <GooglePlayPlanCard
                key={planKey}
                planKey={planKey}
                plan={planFor(planKey)}
                isCurrent={currentPlan === planKey && googlePlayLinked}
                loading={startingPlan === planKey}
                onPress={() => startGooglePlaySubscription(planKey)}
              />
            ))}

            {billingError ? (
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
                  <Text style={{ flex: 1, color: colors.text, fontWeight: "900" }}>Google Play setup needed</Text>
                </View>
                <Text style={{ color: colors.muted, lineHeight: 20 }}>{billingError}</Text>
              </View>
            ) : null}
          </SectionCard>

          <SectionCard title="Premium Direction" subtitle="Free helps them begin. Paid plans help them grow with clarity and pride.">
            <FeatureRow icon="speedometer-outline" label="Professional removes growth limits and reduces daily friction for the team." />
            <FeatureRow icon="git-branch-outline" label="Clinic Intelligence highlights flow problems, missed opportunities, and pending collection pressure." />
            <FeatureRow icon="sparkles-outline" label="Smile Gallery and Share Studio celebrate clinical work while keeping core clinic management free." />
          </SectionCard>
        </>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton
          title="Dashboard"
          icon="home-outline"
          variant="secondary"
          onPress={goDashboard}
          loading={loading}
          style={{ flex: 1 }}
        />
        {!paidPlanActive ? (
          <AppButton
            title="Reload Billing"
            icon="refresh-circle-outline"
            variant="ghost"
            onPress={loadBillingPlans}
            loading={loadingBilling}
            style={{ flex: 1 }}
          />
        ) : null}
      </View>
    </Screen>
  );
}
