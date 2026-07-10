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
  buildStaffPerformanceReport,
  StaffPerformanceRangeKey,
  StaffPerformanceReport,
  StaffPerformanceRow,
} from "@/lib/staffPerformance";

const RANGE_OPTIONS: { key: StaffPerformanceRangeKey; title: string; subtitle: string }[] = [
  { key: "today", title: "Today", subtitle: "Daily work" },
  { key: "week", title: "7 Days", subtitle: "Recent work" },
  { key: "month", title: "Month", subtitle: "Monthly view" },
  { key: "all", title: "All", subtitle: "All available" },
];

function money(value?: number) {
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

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <View
      style={{
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: "30%",
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900", marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

function StaffCard({ row, rank }: { row: StaffPerformanceRow; rank: number }) {
  const activeText = row.active ? "Active" : "Inactive";
  const activeTone = row.active ? "success" : "warning";

  return (
    <View
      style={{
        borderRadius: 24,
        padding: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: rank === 1 ? colors.successSoft : colors.primarySoft,
          }}
        >
          <Text style={{ color: rank === 1 ? colors.success : colors.primary, fontSize: 17, fontWeight: "900" }}>
            #{rank}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
            {row.name}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>
            {row.role}{row.lastActivityAt ? ` • Last ${row.lastActivityAt}` : ""}
          </Text>
        </View>

        <StatusBadge label={activeText} tone={activeTone} />
      </View>

      <View
        style={{
          borderRadius: 18,
          padding: 12,
          backgroundColor: colors.primarySoft,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Ionicons name="analytics-outline" size={21} color={colors.primary} />
        <Text style={{ flex: 1, color: colors.text, fontWeight: "900" }}>Work Score</Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>{row.score}</Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <MetricPill label="Revenue" value={money(row.revenue)} />
        <MetricPill label="Visits" value={row.visits} />
        <MetricPill label="Payments" value={row.payments} />
        <MetricPill label="Uploads" value={row.uploads} />
        <MetricPill label="Appts" value={row.appointments} />
        <MetricPill label="Tablets" value={row.tablets} />
        <MetricPill label="Edits" value={row.edits} />
      </View>
    </View>
  );
}

export default function StaffPerformanceScreen() {
  const [range, setRange] = useState<StaffPerformanceRangeKey>("today");
  const [report, setReport] = useState<StaffPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  const topStaff = useMemo(() => {
    return report?.rows.find((row) => row.score > 0) || null;
  }, [report?.rows]);

  async function load(nextRange = range) {
    try {
      setLoading(true);
      const data = await buildStaffPerformanceReport(nextRange);
      setReport(data);
    } catch (error) {
      Alert.alert("Staff performance load failed", errorMessage(error));
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
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Staff Performance
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Owner view of staff work, collections, visits, uploads, appointments and edits. Data is limited to this clinic only.
        </Text>
      </View>

      <SectionCard title="Range" subtitle="Choose how much activity to review.">
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
            <StatCard label="Staff" value={loading ? "..." : report.summary.staff} icon="people-outline" />
            <StatCard label="Active" value={loading ? "..." : report.summary.activeStaff} icon="person-add-outline" tone="success" />
            <StatCard label="Visits" value={loading ? "..." : report.summary.visits} icon="clipboard-outline" />
            <StatCard label="Revenue" value={loading ? "..." : money(report.summary.revenue)} icon="cash-outline" tone="success" />
          </View>

          <SectionCard title="Top Performer" subtitle={`Generated ${report.generatedAt} • ${report.rangeLabel}`}>
            {topStaff ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 20,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.successSoft,
                  }}
                >
                  <Ionicons name="trophy-outline" size={26} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>{topStaff.name}</Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>
                    Score {topStaff.score} • {money(topStaff.revenue)} collected
                  </Text>
                </View>
              </View>
            ) : (
              <EmptyState
                title="No staff activity yet"
                message="Select a wider range or add visits/payments/uploads to see performance."
                icon="analytics-outline"
              />
            )}
          </SectionCard>

          <SectionCard title="Staff-wise Work" subtitle="Sorted by work score. Higher score means more clinic activity.">
            <View style={{ gap: 12 }}>
              {report.rows.length ? (
                report.rows.map((row, index) => <StaffCard key={row.staffId} row={row} rank={index + 1} />)
              ) : (
                <EmptyState title="No staff found" message="Staff records will appear here after onboarding." icon="people-outline" />
              )}
            </View>
          </SectionCard>
        </>
      ) : (
        <SectionCard>
          <EmptyState title="No report loaded" message="Pull down to refresh and generate staff performance." icon="analytics-outline" />
        </SectionCard>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton title="Refresh" icon="refresh-outline" variant="secondary" onPress={() => load(range)} loading={loading} style={{ flex: 1 }} />
        <AppButton title="Back" icon="arrow-back-outline" variant="ghost" onPress={() => router.replace("/reports/clinic" as never)} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
