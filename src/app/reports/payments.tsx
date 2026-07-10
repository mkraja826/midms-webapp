import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatCard } from "@/components/StatCard";
import { colors } from "@/constants/colors";
import { buildPaymentReview, PaymentReviewRangeKey, PaymentReviewReport, PaymentReviewTotal } from "@/lib/paymentReview";

const RANGE_OPTIONS: { key: PaymentReviewRangeKey; title: string; subtitle: string }[] = [
  { key: "today", title: "Today", subtitle: "Daily closing" },
  { key: "week", title: "7 Days", subtitle: "Recent collections" },
  { key: "month", title: "Month", subtitle: "Current month" },
  { key: "all", title: "All", subtitle: "All collections" },
];

function money(value?: number | string | null) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Please try again.";
}

function TotalRow({ item }: { item: PaymentReviewTotal }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 18,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.successSoft,
        }}
      >
        <Ionicons name="cash-outline" size={19} color={colors.success} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>{item.label}</Text>
        <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
          {item.count} collection{item.count === 1 ? "" : "s"}
        </Text>
      </View>

      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{money(item.amount)}</Text>
    </View>
  );
}

export default function OwnerPaymentReviewScreen() {
  const [range, setRange] = useState<PaymentReviewRangeKey>("today");
  const [report, setReport] = useState<PaymentReviewReport | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(nextRange = range) {
    try {
      setLoading(true);
      const data = await buildPaymentReview(nextRange);
      setReport(data);
    } catch (error) {
      Alert.alert("Payment review failed", errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range);
  }, [range]);

  return (
    <Screen refreshing={loading} onRefresh={() => load(range)}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>Payment Review</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Owner closing view for collections, payment methods, staff collections, and current pending dues.
        </Text>
      </View>

      <SectionCard title="Review Range" subtitle="Choose the collection period to verify.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {RANGE_OPTIONS.map((item) => {
            const selected = range === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setRange(item.key)}
                style={{
                  width: "47%",
                  minHeight: 82,
                  borderRadius: 20,
                  padding: 12,
                  backgroundColor: selected ? colors.primary : colors.background,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: selected ? colors.white : colors.text, fontSize: 17, fontWeight: "900" }}>
                  {item.title}
                </Text>
                <Text style={{ color: selected ? "rgba(255,255,255,0.78)" : colors.muted, fontWeight: "800" }}>
                  {item.subtitle}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      {report ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <StatCard label="Revenue" value={loading ? "..." : money(report.summary.revenue)} icon="cash-outline" tone="success" />
            <StatCard label="Collections" value={loading ? "..." : report.summary.collections} icon="receipt-outline" />
            <StatCard label="Pending Due" value={loading ? "..." : money(report.summary.pendingDue)} icon="wallet-outline" tone="warning" />
            <StatCard label="Pending Bills" value={loading ? "..." : report.summary.pendingInvoices} icon="alert-circle-outline" tone="warning" />
          </View>

          <SectionCard title="Payment Methods" subtitle={`Generated ${report.generatedAt} • ${report.rangeLabel}`}>
            {report.methodTotals.length ? (
              <View style={{ gap: 10 }}>
                {report.methodTotals.map((item) => <TotalRow key={item.label} item={item} />)}
              </View>
            ) : (
              <EmptyState title="No collections" message="No payments found for this range." icon="cash-outline" />
            )}
          </SectionCard>

          <SectionCard title="Collection Types" subtitle="OP, X-ray, treatment, pending and other collections.">
            {report.categoryTotals.length ? (
              <View style={{ gap: 10 }}>
                {report.categoryTotals.map((item) => <TotalRow key={item.label} item={item} />)}
              </View>
            ) : (
              <EmptyState title="No collection types" message="Collection categories will appear after payments are recorded." icon="receipt-outline" />
            )}
          </SectionCard>

          <SectionCard title="Staff Collections" subtitle="Use this to verify receptionist/doctor collection responsibility.">
            {report.staffTotals.length ? (
              <View style={{ gap: 10 }}>
                {report.staffTotals.map((item) => <TotalRow key={item.label} item={item} />)}
              </View>
            ) : (
              <EmptyState title="No staff collections" message="Staff totals appear after payments are collected." icon="people-outline" />
            )}
          </SectionCard>

          <SectionCard title="Recent Payments" subtitle="Latest owner-friendly payment records. No internal IDs shown.">
            {report.recentPayments.length ? (
              <View style={{ gap: 10 }}>
                {report.recentPayments.map((payment, index) => (
                  <View
                    key={`${payment.createdAt}-${index}`}
                    style={{
                      padding: 12,
                      borderRadius: 18,
                      backgroundColor: colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={{ flex: 1, color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                        {payment.patient}
                      </Text>
                      <Text style={{ color: colors.success, fontWeight: "900", fontSize: 16 }}>{money(payment.amount)}</Text>
                    </View>
                    <Text style={{ color: colors.muted, lineHeight: 19 }}>
                      {payment.category} • {payment.method} • {payment.staff}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{payment.createdAt}</Text>
                    {payment.notes ? <Text style={{ color: colors.text, fontSize: 12 }}>{payment.notes}</Text> : null}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No recent payments" message="Payments in this range will appear here." icon="receipt-outline" />
            )}
          </SectionCard>

          <SectionCard title="Current Pending Dues" subtitle="All current unpaid/partial invoices for this clinic.">
            {report.pendingInvoices.length ? (
              <View style={{ gap: 10 }}>
                {report.pendingInvoices.map((invoice, index) => (
                  <View
                    key={`${invoice.createdAt}-${index}`}
                    style={{
                      padding: 12,
                      borderRadius: 18,
                      backgroundColor: colors.warningSoft,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 6,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={{ flex: 1, color: colors.text, fontWeight: "900" }} numberOfLines={1}>
                        {invoice.patient}
                      </Text>
                      <Text style={{ color: colors.warning, fontWeight: "900", fontSize: 16 }}>{money(invoice.due)}</Text>
                    </View>
                    <Text style={{ color: colors.muted, lineHeight: 19 }}>
                      Total {money(invoice.total)} • Paid {money(invoice.paid)} • {invoice.status}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{invoice.createdAt}</Text>
                    {invoice.notes ? <Text style={{ color: colors.text, fontSize: 12 }}>{invoice.notes}</Text> : null}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState title="No pending dues" message="No unpaid/partial invoices found for this clinic." icon="checkmark-circle-outline" />
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard>
          <EmptyState title="No payment review loaded" message="Pull down to refresh payment review." icon="cash-outline" />
        </SectionCard>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton title="Refresh" icon="refresh-outline" variant="secondary" onPress={() => load(range)} loading={loading} style={{ flex: 1 }} />
        <AppButton title="Back to Report" icon="arrow-back-outline" variant="ghost" onPress={() => router.replace("/reports/clinic" as never)} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
