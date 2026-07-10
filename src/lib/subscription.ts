import { getCurrentProfile, supabase } from "@/lib/supabase";

export type ClinicSubscriptionStatus = "trial" | "active" | "expired" | "cancelled" | "grace_period";
export type SubscriptionBillingCycle = "monthly" | "yearly";
export type SubscriptionPaymentStatus = "pending_review" | "approved" | "rejected" | "cancelled";

export const SUBSCRIPTION_MONTHLY_AMOUNT = 799;
export const SUBSCRIPTION_YEARLY_AMOUNT = SUBSCRIPTION_MONTHLY_AMOUNT * 12;

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

export async function getClinicSubscription() {
  const profile = await getCurrentProfile();

  if (!profile?.clinic_id) return null;

  const { data, error } = await supabase
    .from("clinic_subscriptions")
    .select(
      "id,clinic_id,plan_name,status,trial_started_at,trial_ends_at,current_period_start,current_period_end,monthly_price,visit_limit,created_at,updated_at"
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

  if (subscription.status === "cancelled") {
    return {
      allowed: false,
      blocked: true,
      reason: "This clinic subscription is cancelled. Owner renewal is required to continue using MiDMS.",
      statusLabel: "Cancelled",
    };
  }

  if (subscription.status === "expired") {
    return {
      allowed: false,
      blocked: true,
      reason: "This clinic subscription is expired. Owner renewal is required to continue using MiDMS.",
      statusLabel: "Expired",
    };
  }

  if (subscription.status === "trial" && isExpiredDate(subscription.trial_ends_at)) {
    return {
      allowed: false,
      blocked: true,
      reason: "The free trial period has ended. Owner renewal is required to continue using MiDMS.",
      statusLabel: "Trial ended",
    };
  }

  if (subscription.status === "active" && isExpiredDate(subscription.current_period_end)) {
    return {
      allowed: false,
      blocked: true,
      reason: "The current paid period has ended. Owner renewal is required to continue using MiDMS.",
      statusLabel: "Payment due",
    };
  }

  if (subscription.status === "grace_period" && isExpiredDate(subscription.current_period_end)) {
    return {
      allowed: false,
      blocked: true,
      reason: "The grace period has ended. Owner renewal is required to continue using MiDMS.",
      statusLabel: "Grace ended",
    };
  }

  return {
    allowed: true,
    blocked: false,
    reason: "Clinic access is active.",
    statusLabel:
      subscription.status === "trial"
        ? "Trial active"
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
      priceText: "₹799/month after trial",
    };
  }

  const status = subscription.status;
  const access = getSubscriptionAccess(subscription);
  const daysLeft =
    status === "trial" ? daysUntil(subscription.trial_ends_at) : daysUntil(subscription.current_period_end);
  const renewalDate =
    status === "trial"
      ? formatPlanDate(subscription.trial_ends_at)
      : formatPlanDate(subscription.current_period_end);
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
      title: safeDaysLeft > 0 ? `Free trial active • ${safeDaysLeft} days left` : "Free trial active",
      subtitle: `Trial ends on ${renewalDate}. ${priceText} after trial.`,
      tone: safeDaysLeft <= 10 ? ("warning" as const) : ("success" as const),
      daysLeft,
      renewalDate,
      priceText,
    };
  }

  if (status === "active") {
    return {
      title: "Subscription active",
      subtitle: `Current period ends on ${renewalDate}. ${priceText}.`,
      tone: "success" as const,
      daysLeft,
      renewalDate,
      priceText,
    };
  }

  if (status === "grace_period") {
    return {
      title: "Grace period active",
      subtitle: `Renew before ${renewalDate} to avoid interruption. ${priceText}.`,
      tone: "warning" as const,
      daysLeft,
      renewalDate,
      priceText,
    };
  }

  return {
    title: status === "cancelled" ? "Subscription cancelled" : "Subscription expired",
    subtitle: "Renewal is required to continue after the trial/subscription period.",
    tone: "danger" as const,
    daysLeft,
    renewalDate,
    priceText,
  };
}
