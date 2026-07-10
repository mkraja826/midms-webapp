import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import {
  addGooglePlayPurchaseListeners,
  endGooglePlayBilling,
  finishGooglePlaySubscriptionPurchase,
  GOOGLE_PLAY_MONTHLY_PRODUCT_ID,
  GOOGLE_PLAY_TRIAL_OFFER_ID,
  googlePlayBillingUnavailableReason,
  GooglePlayBillingOffer,
  launchGooglePlaySubscriptionPurchase,
  loadGooglePlayBillingOffer,
  recordGooglePlaySubscriptionPurchase,
} from "@/lib/googlePlayBilling";
import { useAuth } from "@/lib/auth";
import { getDashboardPath } from "@/lib/supabase";
import {
  formatSubscriptionDateTime,
  getClinicSubscription,
  getSubscriptionAccess,
  getSubscriptionDisplay,
  googlePlayBillingStatusLabel,
  hasGooglePlayAutopay,
  SUBSCRIPTION_MONTHLY_AMOUNT,
} from "@/lib/subscription";
import type { ClinicSubscription } from "@/lib/subscription";

function money(value: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Text style={{ flex: 1, color: colors.muted, fontWeight: "800" }}>{label}</Text>
      <Text selectable style={{ flex: 1, color: colors.text, fontWeight: "900", textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

function GooglePlayPlanCard({ offer, onPress }: { offer: GooglePlayBillingOffer | null; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 28,
        padding: 16,
        gap: 14,
        borderWidth: 1,
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="logo-google-playstore" size={25} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: "900" }}>Google Play Monthly</Text>
          <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 20 }}>
            3 months free trial, then auto-renews monthly.
          </Text>
        </View>
        <StatusBadge label="Autopay" tone="success" />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
          {offer?.displayPrice || `${money(SUBSCRIPTION_MONTHLY_AMOUNT)} / month`}
        </Text>
        <Text style={{ color: colors.muted, lineHeight: 20 }}>
          Owner confirms once in Google Play. Google handles renewal after the free trial unless the owner cancels in Play Store.
        </Text>
      </View>
    </Pressable>
  );
}

export default function SubscriptionScreen() {
  const params = useLocalSearchParams<{ locked?: string }>();
  const { profile } = useAuth();
  const [subscription, setSubscription] = useState<ClinicSubscription | null>(null);
  const [billingOffer, setBillingOffer] = useState<GooglePlayBillingOffer | null>(null);
  const [billingError, setBillingError] = useState<string | null>(googlePlayBillingUnavailableReason());
  const [loading, setLoading] = useState(true);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);

  const locked = params.locked === "1";
  const subscriptionInfo = getSubscriptionDisplay(subscription);
  const access = getSubscriptionAccess(subscription);
  const googlePlayLinked = hasGooglePlayAutopay(subscription);

  const summary = useMemo(
    () => ({
      title: "3-month free trial",
      amount: `${money(SUBSCRIPTION_MONTHLY_AMOUNT)} / month after trial`,
      note: "Google Play auto-renewing monthly subscription",
    }),
    []
  );

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

  async function loadBillingOffer() {
    if (Platform.OS !== "android") {
      setBillingError("Google Play Billing works only inside the Android app installed from Play testing/production.");
      return;
    }

    try {
      setLoadingBilling(true);
      setBillingError(null);
      const offer = await loadGooglePlayBillingOffer();
      setBillingOffer(offer);

      if (!offer) {
        setBillingError(
          `Subscription product not found. Create product ${GOOGLE_PLAY_MONTHLY_PRODUCT_ID} with a 3-month free trial offer in Play Console.`
        );
      }
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Google Play Billing could not load subscription offer.");
    } finally {
      setLoadingBilling(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile?.clinic_id]);

  useEffect(() => {
    loadBillingOffer();

    const cleanup = addGooglePlayPurchaseListeners({
      onPurchase: async (purchase) => {
        try {
          const updatedSubscription = await recordGooglePlaySubscriptionPurchase(purchase);
          await finishGooglePlaySubscriptionPurchase(purchase);
          setSubscription(updatedSubscription as ClinicSubscription);
          await load();

          Alert.alert(
            "Google Play trial started",
            "MiDMS is now linked to Google Play. The clinic gets 3 months free trial and Google Play will auto-renew monthly after the trial unless cancelled."
          );
        } catch (error) {
          Alert.alert("Subscription save failed", error instanceof Error ? error.message : "Please try again.");
        }
      },
      onError: (message) => {
        setStartingTrial(false);
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

  async function startGooglePlayTrial() {
    try {
      setStartingTrial(true);

      let offer = billingOffer;
      if (!offer) {
        offer = await loadGooglePlayBillingOffer();
        setBillingOffer(offer);
      }

      if (!offer) {
        throw new Error(`Subscription product ${GOOGLE_PLAY_MONTHLY_PRODUCT_ID} was not returned by Google Play.`);
      }

      await launchGooglePlaySubscriptionPurchase(offer);
    } catch (error) {
      Alert.alert("Google Play subscription failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setStartingTrial(false);
    }
  }

  return (
    <Screen refreshing={loading || loadingBilling} onRefresh={() => { load(); loadBillingOffer(); }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>Subscription</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Start Google Play 3-month free trial. After trial, Google Play handles automatic monthly billing.
        </Text>
      </View>

      {locked || access.blocked ? (
        <SectionCard title="Clinic Access Paused" subtitle="Google Play subscription is required before staff can continue normal clinic work.">
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
              <Ionicons name={googlePlayLinked ? "logo-google-playstore" : "shield-checkmark-outline"} size={25} color={colors.primary} />
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

      <SectionCard title="Google Play Autopay" subtitle="This replaces manual UPI/cash renewal requests.">
        <GooglePlayPlanCard offer={billingOffer} onPress={startGooglePlayTrial} />

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

        <AppButton
          title={googlePlayLinked ? "Google Play Linked" : "Start 3-Month Free Trial"}
          icon={googlePlayLinked ? "checkmark-circle-outline" : "logo-google-playstore"}
          onPress={startGooglePlayTrial}
          loading={startingTrial || loadingBilling}
          loadingTitle={startingTrial ? "Opening Google Play..." : "Loading Play Billing..."}
          disabled={googlePlayLinked || Platform.OS !== "android"}
        />
      </SectionCard>

      <SectionCard title="Billing Summary" subtitle="What the clinic owner accepts in Google Play.">
        <View style={{ gap: 12 }}>
          <DetailRow label="Trial" value={summary.title} />
          <DetailRow label="After trial" value={summary.amount} />
          <DetailRow label="Billing" value={summary.note} />
          <DetailRow label="Product ID" value={GOOGLE_PLAY_MONTHLY_PRODUCT_ID} />
          <DetailRow label="Trial offer ID" value={GOOGLE_PLAY_TRIAL_OFFER_ID} />
          {billingOffer?.basePlanId ? <DetailRow label="Base plan" value={billingOffer.basePlanId} /> : null}
          {billingOffer?.offerId ? <DetailRow label="Offer" value={billingOffer.offerId} /> : null}
        </View>
      </SectionCard>

      <SectionCard title="Google Play Status" subtitle="Stored billing link for this clinic.">
        <View style={{ gap: 12 }}>
          <DetailRow label="Billing provider" value={subscription?.billing_provider || "google_play"} />
          <DetailRow label="Play status" value={googlePlayBillingStatusLabel(subscription?.google_play_status)} />
          <DetailRow label="Autopay" value={subscription?.google_play_auto_renewing ? "Enabled" : googlePlayLinked ? "Linked" : "Not started"} />
          <DetailRow label="Linked at" value={formatSubscriptionDateTime(subscription?.google_play_linked_at)} />
          <DetailRow label="Last event" value={formatSubscriptionDateTime(subscription?.google_play_last_event_at)} />
        </View>
      </SectionCard>

      <SectionCard title="Included" subtitle="Core clinic tools covered under MiDMS subscription.">
        <FeatureRow icon="people-outline" label="Unlimited patient search and clinical history" />
        <FeatureRow icon="cloud-upload-outline" label="Photo, prescription, report and X-ray uploads" />
        <FeatureRow icon="cash-outline" label="OP, X-ray, medication and pending payment tracking" />
        <FeatureRow icon="notifications-outline" label="Follow-up and payment reminder workflow" />
        <FeatureRow icon="lock-closed-outline" label="Role-based access for owner, doctor and reception" />
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
          title="Reload Billing"
          icon="refresh-circle-outline"
          variant="ghost"
          onPress={loadBillingOffer}
          loading={loadingBilling}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}
