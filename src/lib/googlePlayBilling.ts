import { Platform } from "react-native";
import { getCurrentProfile, supabase } from "@/lib/supabase";

export const GOOGLE_PLAY_MONTHLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_PLAY_MONTHLY_PRODUCT_ID || "midms_monthly_799";
export const GOOGLE_PLAY_TRIAL_OFFER_ID =
  process.env.EXPO_PUBLIC_GOOGLE_PLAY_TRIAL_OFFER_ID || "three-month-free-trial";

export type GooglePlayBillingOffer = {
  productId: string;
  title: string;
  description: string;
  displayPrice: string;
  offerToken: string | null;
  basePlanId: string | null;
  offerId: string | null;
  trialText: string;
  rawProduct: any;
};

function getIapModule() {
  try {
    return require("react-native-iap");
  } catch {
    return null;
  }
}

function isAndroid() {
  return Platform.OS === "android";
}

export function googlePlayBillingUnavailableReason() {
  if (!isAndroid()) return "Google Play Billing is available only inside the Android app.";
  if (!getIapModule()) return "Google Play Billing package is not installed yet. Run npm install and rebuild the Android app.";
  return null;
}

export async function initGooglePlayBilling() {
  const reason = googlePlayBillingUnavailableReason();
  if (reason) throw new Error(reason);

  const iap = getIapModule();
  await iap.initConnection();

  if (typeof iap.flushFailedPurchasesCachedAsPendingAndroid === "function") {
    await iap.flushFailedPurchasesCachedAsPendingAndroid().catch(() => undefined);
  }
}

export async function endGooglePlayBilling() {
  const iap = getIapModule();
  if (!iap?.endConnection) return;
  await iap.endConnection().catch(() => undefined);
}

async function getSubscriptionsCompat(skus: string[]) {
  const iap = getIapModule();
  if (!iap?.getSubscriptions) throw new Error("Google Play Billing is not available.");

  try {
    return await iap.getSubscriptions({ skus });
  } catch {
    return await iap.getSubscriptions(skus);
  }
}

function productIdOf(product: any) {
  return String(product?.productId || product?.id || product?.sku || GOOGLE_PLAY_MONTHLY_PRODUCT_ID);
}

function formattedPriceFromOffer(offer: any) {
  const phases = offer?.pricingPhases?.pricingPhaseList || offer?.pricingPhases || [];
  const paidPhase = phases.find((phase: any) => Number(phase?.priceAmountMicros || 0) > 0);
  return paidPhase?.formattedPrice || paidPhase?.price || "₹799/month";
}

function phaseHasFreeTrial(phase: any) {
  const priceMicros = Number(phase?.priceAmountMicros || 0);
  const formatted = String(phase?.formattedPrice || phase?.price || "").toLowerCase();
  const billingPeriod = String(phase?.billingPeriod || "").toUpperCase();

  return priceMicros === 0 || formatted.includes("free") || billingPeriod === "P3M";
}

function offerHasThreeMonthTrial(offer: any) {
  const offerId = String(offer?.offerId || "").toLowerCase();
  const tags = Array.isArray(offer?.offerTags) ? offer.offerTags.map((tag: any) => String(tag).toLowerCase()) : [];
  const phases = offer?.pricingPhases?.pricingPhaseList || offer?.pricingPhases || [];

  return (
    offerId === GOOGLE_PLAY_TRIAL_OFFER_ID ||
    tags.includes(GOOGLE_PLAY_TRIAL_OFFER_ID) ||
    phases.some((phase: any) => phaseHasFreeTrial(phase))
  );
}

function pickTrialOffer(product: any) {
  const offers = product?.subscriptionOfferDetails || [];
  if (!Array.isArray(offers) || offers.length === 0) return null;

  return offers.find((offer: any) => offerHasThreeMonthTrial(offer)) || offers[0];
}

export async function loadGooglePlayBillingOffer(): Promise<GooglePlayBillingOffer | null> {
  await initGooglePlayBilling();

  const products = await getSubscriptionsCompat([GOOGLE_PLAY_MONTHLY_PRODUCT_ID]);
  const product = Array.isArray(products)
    ? products.find((item) => productIdOf(item) === GOOGLE_PLAY_MONTHLY_PRODUCT_ID) || products[0]
    : null;

  if (!product) return null;

  const offer = pickTrialOffer(product);
  const productId = productIdOf(product);

  return {
    productId,
    title: String(product.title || product.name || "MiDMS Monthly"),
    description: String(product.description || "3 months free trial, then monthly auto-renewal through Google Play."),
    displayPrice: offer ? formattedPriceFromOffer(offer) : product.localizedPrice || product.price || "₹799/month",
    offerToken: offer?.offerToken || null,
    basePlanId: offer?.basePlanId || null,
    offerId: offer?.offerId || null,
    trialText: offer?.offerId || offerHasThreeMonthTrial(offer) ? "3 months free trial" : "Monthly auto-renewal",
    rawProduct: product,
  };
}

export async function launchGooglePlaySubscriptionPurchase(offer: GooglePlayBillingOffer) {
  await initGooglePlayBilling();

  const iap = getIapModule();
  if (!iap?.requestSubscription) throw new Error("Google Play subscription billing is not available.");

  if (!offer.offerToken) {
    throw new Error(
      "3-month free trial offer was not found. Create and activate the trial offer in Play Console, then rebuild/test from Play internal testing."
    );
  }

  return iap.requestSubscription({
    sku: offer.productId,
    subscriptionOffers: [{ sku: offer.productId, offerToken: offer.offerToken }],
  });
}

export function addGooglePlayPurchaseListeners(input: {
  onPurchase: (purchase: any) => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const iap = getIapModule();
  if (!iap?.purchaseUpdatedListener || !iap?.purchaseErrorListener) return () => undefined;

  const purchaseSub = iap.purchaseUpdatedListener(async (purchase: any) => {
    await input.onPurchase(purchase);
  });

  const errorSub = iap.purchaseErrorListener((error: any) => {
    const code = error?.code ? `${error.code}: ` : "";
    input.onError(`${code}${error?.message || "Google Play purchase failed."}`);
  });

  return () => {
    purchaseSub?.remove?.();
    errorSub?.remove?.();
  };
}

export function getGooglePlayPurchaseToken(purchase: any) {
  if (purchase?.purchaseToken) return String(purchase.purchaseToken);

  try {
    const parsed = JSON.parse(String(purchase?.transactionReceipt || "{}"));
    return parsed?.purchaseToken ? String(parsed.purchaseToken) : null;
  } catch {
    return null;
  }
}

export async function recordGooglePlaySubscriptionPurchase(purchase: any) {
  const profile = await getCurrentProfile();
  if (!profile?.clinic_id) throw new Error("Clinic profile not found");

  const purchaseToken = getGooglePlayPurchaseToken(purchase);
  if (!purchaseToken) throw new Error("Google Play purchase token was not returned.");

  const productId = String(
    purchase?.productId ||
      (Array.isArray(purchase?.productIds) ? purchase.productIds[0] : "") ||
      GOOGLE_PLAY_MONTHLY_PRODUCT_ID
  );

  const { data, error } = await supabase.rpc("record_google_play_subscription_purchase", {
    p_product_id: productId,
    p_purchase_token: purchaseToken,
    p_order_id: purchase?.orderId || purchase?.transactionId || null,
    p_auto_renewing: true,
    p_raw_purchase: purchase || {},
  });

  if (error) throw error;
  return data;
}

export async function finishGooglePlaySubscriptionPurchase(purchase: any) {
  const iap = getIapModule();
  if (!iap?.finishTransaction) return;

  try {
    await iap.finishTransaction({ purchase, isConsumable: false });
  } catch {
    await iap.finishTransaction(purchase, false).catch(() => undefined);
  }
}
