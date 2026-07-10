import { GOOGLE_PLAY_MONTHLY_PRODUCT_ID } from "@/lib/googlePlayBilling";
import { getCurrentProfile, supabase } from "@/lib/supabase";

export type ClinicSubscriptionStatus = "trial" | "active" | "expired" | "cancelled" | "grace_period";
export type SubscriptionBillingCycle = "monthly" | "yearly";
export type SubscriptionPaymentStatus = "pending_review" | "approved" | "rejected" | "cancelled";
export type SubscriptionBillingProvider = "google_play" | "manual";
export type GooglePlaySubscriptionStatus =
  | "not_started"
  | "trial_started"
  | "active"
  | "grace_period"
  | "account_hold"
  | "expired"
  | "cancelled"
  | "pending_verification";

export const SUBSCRIPTION_MONTHLY_AMOUNT = 799;
export const SUBSCRIPTION_YEARLY_AMOUNT = SUBSCRIPTION_MONTHLY_AMOUNT * 12;
export const GOOGLE_PLAY_TRIAL_MONTHS = 3;

export type ClinicSubscription = {
  id: string;
  clinic_id: string;
  plan_name: string;
  status: ClinicSubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  monthly_price: number | null;
  visit_limit: number | null;
  billing_provider?: SubscriptionBillingProvider | null;
  google_play_product_id?: string | null;
  google_play_purchase_token?: string | null;
  google_play_order_id?: string | null;
  google_play_auto_renewing?: boolean | null;
  google_play_status?: GooglePlaySubscriptionStatus | null;
  google_play_linked_at?: string | null;
  google_play_last_event_at?: string | null;
  google_play_last_verified_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPaymentRequest = {
  id: string;
  clinic_id: string;
  subscription_id: string | null;
  requested_by: string | null;
  billing_cycle: SubscriptionBillingCycle;
  amount: number;
  payment_method: string;
  payment_reference: string | null;
  owner_note: string | null;
  admin_note: string | null;
  status: SubscriptionPaymentStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionAccess = {
  allowed: boolean;
  blocked: boolean;
  reason: string;
  statusLabel: string;
};

export function subscriptionBillingAmount(cycle: SubscriptionBillingCycle) {
  return cycle === "yearly" ? SUBSCRIPTION_YEARLY_AMOUNT : SUBSCRIPTION_MONTHLY_AMOUNT;
}

export function subscriptionBillingLabel(cycle: SubscriptionBillingCycle) {
  return cycle === "yearly" ? "Yearly" : "Monthly";
}

export function subscriptionPaymentStatusLabel(status?: SubscriptionPaymentStatus | null) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "cancelled") return "Cancelled";
  return "Pending review";
}

export function subscriptionPaymentStatusTone(status?: SubscriptionPaymentStatus | null) {
  if (status === "approved") return "success" as const;
  if (status === "rejected" || status === "cancelled") return "danger" as const;
  return "warning" as const;
}

export function hasGooglePlayAutopay(subscription: ClinicSubscription | null) {
  return Boolean(subscription?.google_play_purchase_token && subscription?.billing_provider === "google_play");
}

export function googlePlayBillingStatusLabel(status?: GooglePlaySubscriptionStatus | null) {
  if (status === "trial_started") return "Google Play trial started";
  if (status === "active") return "Google Play active";
  if (status === "grace_period") return "Google Play grace period";
  if (status === "account_hold") return "Google Play account hold";
  if (status === "pending_verification") return "Google Play verification pending";
  if (status === "expired") return "Google Play expired";
  if (status === "cancelled") return "Google Play cancelled";
  return "Google Play not started";
}

export async function getClinicSubscription() {
  const profile = await getCurrentProfile();

  if (!profile?.clinic_id) return null;

  const { data, error } = await supabase
    .from("clinic_subscriptions")
    .select(
      "id,clinic_id,plan_name,status,trial_started_at,trial_ends_at,current_period_start,current_period_end,monthly_price,visit_limit,billing_provider,google_play_product_id,google_play_purchase_token,google_play_order_id,google_play_auto_renewing,google_play_status,google_play_linked_at,google_play_last_event_at,google_play_last_verified_at,created_at,updated_at"
    )
    .eq("clinic_id", profile.clinic_id)
    .maybeSingle<ClinicSubscription>();

  if (error) {
    console.warn("Subscription load failed:", error.message);
    return null;
  }

  return data;
}

export async function getSubscriptionPaymentRequests(limit = 5) {
  const profile = await getCurrentProfile();

  if (!profile?.clinic_id) return [] as SubscriptionPaymentRequest[];

  const { data, error } = await supabase
    .from("clinic_subscription_payments")
    .select(
      "id,clinic_id,subscription_id,requested_by,billing_cycle,amount,payment_method,payment_reference,owner_note,admin_note,status,requested_at,reviewed_at,reviewed_by,created_at,updated_at"
    )
    .eq("clinic_id", profile.clinic_id)
    .order("requested_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Subscription payment requests load failed:", error.message);
    return [] as SubscriptionPaymentRequest[];
  }

  return (data || []) as SubscriptionPaymentRequest[];
}

export async function requestSubscriptionPayment(input: {
  billingCycle: SubscriptionBillingCycle;
  paymentReference?: string;
  ownerNote?: string;
}) {
  const { data, error } = await supabase.rpc("request_clinic_subscription_payment", {
    p_billing_cycle: input.billingCycle,
    p_payment_reference: input.paymentReference?.trim() || null,
    p_owner_note: input.ownerNote?.trim() || null,
  });

  if (error) throw error;
  return data as SubscriptionPaymentRequest;
}

export function daysUntil(value?: string | null) {
  if (!value) return null;

  const end = new Date(value).getTime();
  if (!Number.isFinite(end)) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = end - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isExpiredDate(value?: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return time < Date.now();
}

export function formatPlanDate(value?: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatSubscriptionDateTime(value?: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getSubscriptionAccess(subscription: ClinicSubscription | null): SubscriptionAccess {
  if (!subscription) {
    return {
      allowed: true,
      blocked: false,
      reason: "Subscription row was not loaded. Access is kept open so pilot clinics are not blocked by migration issues.",
      statusLabel: "Not loaded",
    };
  }

  if (subscription.status === "cancelled" || subscription.google_play_status === "cancelled") {
    return {
      allowed: false,
      blocked: true,
      reason: "This clinic subscription is cancelled. Owner renewal through Google Play is required to continue using MiDMS.",
      statusLabel: "Cancelled",
    };
  }

  if (subscription.google_play_status === "account_hold") {
    return {
      allowed: false,
      blocked: true,
      reason: "Google Play payment is unresolved. The owner must fix the payment method in Google Play to continue using MiDMS.",
      statusLabel: "Account hold",
    };
  }

  if (subscription.status === "expired" || subscription.google_play_status === "expired") {
    return {
      allowed: false,
      blocked: true,
      reason: "This clinic subscription is expired. Start or renew the MiDMS subscription through Google Play.",
      statusLabel: "Expired",
    };
  }

  if (subscription.status === "trial" && isExpiredDate(subscription.trial_ends_at)) {
    return {
      allowed: false,
      blocked: true,
      reason: "The free trial period has ended. Google Play subscription is required to continue using MiDMS.",
      statusLabel: "Trial ended",
    };
  }

  if (subscription.status === "active" && isExpiredDate(subscription.current_period_end)) {
    return {
      allowed: false,
      blocked: true,
      reason: "The current paid period has ended. Google Play renewal is required to continue using MiDMS.",
      statusLabel: "Payment due",
    };
  }

  if (subscription.status === "grace_period" && isExpiredDate(subscription.current_period_end)) {
    return {
      allowed: false,
      blocked: true,
      reason: "The grace period has ended. Google Play renewal is required to continue using MiDMS.",
      statusLabel: "Grace ended",
    };
  }

  return {
    allowed: true,
    blocked: false,
    reason: "Clinic access is active.",
    statusLabel:
      subscription.status === "trial"
        ? hasGooglePlayAutopay(subscription)
          ? "Google Play trial"
          : "Trial active"
        : subscription.status === "active"
        ? "Active"
        : subscription.status === "grace_period"
        ? "Grace period"
        : subscription.status,
  };
}

export function getSubscriptionDisplay(subscription: ClinicSubscription | null) {
  if (!subscription) {
    return {
      title: "Trial not loaded",
      subtitle: "Run the subscription SQL migration before testing new clinic trials.",
      tone: "warning" as const,
      daysLeft: null as number | null,
      renewalDate: "Not set",
      priceText: "₹799/month after 3-month free trial",
    };
  }

  const status = subscription.status;
  const access = getSubscriptionAccess(subscription);
  const googlePlayReady = hasGooglePlayAutopay(subscription);
  const daysLeft =
    status === "trial" ? daysUntil(subscription.trial_ends_at) : daysUntil(subscription.current_period_end);
  const renewalDate =
    status === "trial"
      ? formatPlanDate(subscription.trial_ends_at)
      : formatPlanDate(subscription.current_period_end);
  const productId = subscription.google_play_product_id || GOOGLE_PLAY_MONTHLY_PRODUCT_ID;
  const priceText = `₹${Math.round(Number(subscription.monthly_price || 799)).toLocaleString("en-IN")}/month`;

  if (access.blocked) {
    return {
      title: access.statusLabel,
      subtitle: access.reason,
      tone: "danger" as const,
      daysLeft,
      renewalDate,
      priceText,
    };
  }

  if (status === "trial") {
    const safeDaysLeft = daysLeft ?? 0;
    return {
      title: googlePlayReady
        ? `Google Play trial active • ${safeDaysLeft > 0 ? `${safeDaysLeft} days left` : "trial period"}`
        : safeDaysLeft > 0
        ? `Free trial active • ${safeDaysLeft} days left`
        : "Free trial active",
      subtitle: googlePlayReady
        ? `Autopay is linked to ${productId}. Google Play renews after ${renewalDate} unless the owner cancels.`
        : `Trial ends on ${renewalDate}. Start Google Play free trial now so billing continues automatically after 3 months.`,
      tone: googlePlayReady ? ("success" as const) : safeDaysLeft <= 10 ? ("warning" as const) : ("success" as const),
      daysLeft,
      renewalDate,
      priceText,
    };
  }

  if (status === "active") {
    return {
      title: googlePlayReady ? "Google Play subscription active" : "Subscription active",
      subtitle: googlePlayReady
        ? `Autopay is active through Google Play. Current period ends on ${renewalDate}. ${priceText}.`
        : `Current period ends on ${renewalDate}. ${priceText}.`,
      tone: "success" as const,
      daysLeft,
      renewalDate,
      priceText,
    };
  }

  if (status === "grace_period") {
    return {
      title: "Grace period active",
      subtitle: googlePlayReady
        ? `Ask owner to fix Google Play payment before ${renewalDate}. ${priceText}.`
        : `Renew before ${renewalDate} to avoid interruption. ${priceText}.`,
      tone: "warning" as const,
      daysLeft,
      renewalDate,
      priceText,
    };
  }

  return {
    title: status === "cancelled" ? "Subscription cancelled" : "Subscription expired",
    subtitle: "Google Play subscription is required to continue after the trial/subscription period.",
    tone: "danger" as const,
    daysLeft,
    renewalDate,
    priceText,
  };
}
