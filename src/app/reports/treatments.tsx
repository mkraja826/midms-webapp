import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import {
  buildTreatmentReviewReport,
  TreatmentReviewItem,
  TreatmentReviewRangeKey,
  TreatmentReviewReport,
} from "@/lib/treatmentReview";

const RANGES: { key: TreatmentReviewRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "7 Days" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

const STATUS_FILTERS = ["all", "planned", "ongoing", "completed", "cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function money(value?: number | null) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function dateText(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  if (status === "ongoing") return "Ongoing";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Planned";
}

function statusTone(status: string): "primary" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "ongoing") return "warning";
  if (status === "cancelled") return "danger";
  return "primary";
}

function TreatmentRow({ item }: { item: TreatmentReviewItem }) {
  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 17,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="hammer-outline" size={22} color={colors.primary} />
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>{item.treatmentName}</Text>
          <Text style={{ color: colors.muted, lineHeight: 19 }}>
            {item.patientName} • {item.patientCode} • {item.patientPhone}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Doctor: {item.doctorName} • {dateText(item.createdAt)}
          </Text>
        </View>

        <StatusBadge label={statusLabel(item.status)} tone={statusTone(item.status)} />
      </View>

      {item.description ? <Text style={{ color: colors.muted, lineHeight: 19 }}>{item.description}</Text> : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ flex: 1, minWidth: "45%", padding: 12, borderRadius: 16, backgroundColor: colors.surfaceSoft }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Treatment Value</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 }}>{money(item.cost)}</Text>
        </View>

        <View style={{ flex: 1, minWidth: "45%", padding: 12, borderRadius: 16, backgroundColor: item.pendingDue > 0 ? colors.warningSoft : colors.successSoft }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>Patient Pending</Text>
          <Text style={{ color: item.pendingDue > 0 ? colors.warning : colors.success, fontSize: 18, fontWeight: "900", marginTop: 4 }}>{money(item.pendingDue)}</Text>
        </View>
      </View>

      <AppButton
        title="Open Patient"
        icon="person-outline"
        variant="secondary"
        onPress={() => router.push(`/patient/${item.patientId}` as never)}
      />
    </View>
  );
}

export default function TreatmentReviewScreen() {
  const [range, setRange] = useState<TreatmentReviewRangeKey>("month");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [report, setReport] = useState<TreatmentReviewReport | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(selectedRange = range) {
    try {
      setLoading(true);
      const data = await buildTreatmentReviewReport(selectedRange);
      setReport(data);
    } catch (error) {
      Alert.alert("Treatment review failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range);
  }, [range]);

  const items = report?.items ?? [];
  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const s = report?.summary;

  return (
    <Screen refreshing={loading} onRefresh={() => load(range)}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>Treatment Review</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Owner view for planned, ongoing, completed and pending-value treatment work.
        </Text>
      </View>

      <SectionCard title="Range" subtitle={report ? `${report.rangeLabel} • Generated ${report.generatedAt}` : "Choose report range."}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {RANGES.map((item) => {
            const selected = range === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setRange(item.key)}
                style={{
                  flex: 1,
                  minWidth: "22%",
                  minHeight: 46,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected ? colors.primary : colors.background,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: selected ? colors.white : colors.text, fontWeight: "900" }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="Total Value" value={loading ? "..." : money(s?.totalValue)} icon="cash-outline" tone="success" />
        <StatCard label="Open Value" value={loading ? "..." : money(s?.openValue)} icon="time-outline" tone="warning" />
        <StatCard label="Completed" value={loading ? "..." : s?.completed ?? 0} icon="checkmark-done-outline" tone="success" />
        <StatCard label="Pending Due" value={loading ? "..." : money(s?.patientPendingDue)} icon="wallet-outline" tone="warning" />
      </View>

      <SectionCard title="Status Split" subtitle="Quick view of treatment pipeline.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <StatCard label="Planned" value={loading ? "..." : s?.planned ?? 0} icon="clipboard-outline" />
          <StatCard label="Ongoing" value={loading ? "..." : s?.ongoing ?? 0} icon="sync-outline" tone="warning" />
          <StatCard label="Cancelled" value={loading ? "..." : s?.cancelled ?? 0} icon="close-circle-outline" tone="danger" />
          <StatCard label="Treatments" value={loading ? "..." : s?.totalTreatments ?? 0} icon="medical-outline" />
        </View>
      </SectionCard>

      <SectionCard title="Filter" subtitle="Show treatment records by status.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {STATUS_FILTERS.map((item) => {
            const selected = statusFilter === item;
            return (
              <Pressable
                key={item}
                onPress={() => setStatusFilter(item)}
                style={{
                  minHeight: 42,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected ? colors.primary : colors.background,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: selected ? colors.white : colors.text, fontWeight: "900" }}>
                  {item === "all" ? "All" : statusLabel(item)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard title="Treatment Records" subtitle="Only current clinic patients are shown.">
        {loading ? (
          <Text style={{ color: colors.muted }}>Loading treatment review...</Text>
        ) : filteredItems.length ? (
          <View style={{ gap: 12 }}>
            {filteredItems.map((item) => <TreatmentRow key={item.id} item={item} />)}
          </View>
        ) : (
          <EmptyState title="No treatments found" message="No treatment records matched this range and status." icon="hammer-outline" />
        )}
      </SectionCard>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton title="Refresh" icon="refresh-outline" variant="secondary" onPress={() => load(range)} loading={loading} style={{ flex: 1 }} />
        <AppButton title="Clinic Report" icon="arrow-back-outline" variant="ghost" onPress={() => router.replace("/reports/clinic" as never)} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
