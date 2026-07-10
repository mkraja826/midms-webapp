import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState, type ComponentProps } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import {
  ActivityRangeKey,
  buildClinicActivityReport,
  ClinicActivityItem,
  ClinicActivityReport,
} from "@/lib/clinicActivity";

type IconName = ComponentProps<typeof Ionicons>["name"];

const RANGE_OPTIONS: { key: ActivityRangeKey; title: string; subtitle: string }[] = [
  { key: "today", title: "Today", subtitle: "Current day" },
  { key: "week", title: "7 Days", subtitle: "Recent activity" },
  { key: "month", title: "Month", subtitle: "Current month" },
  { key: "all", title: "All", subtitle: "Latest 200" },
];

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Please try again.";
}

function dateText(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(value?: number | null) {
  if (!value) return null;
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function iconForKind(kind: ClinicActivityItem["kind"]): IconName {
  if (kind === "payment") return "cash-outline";
  if (kind === "visit") return "clipboard-outline";
  if (kind === "file") return "cloud-upload-outline";
  if (kind === "appointment") return "calendar-outline";
  if (kind === "tablet") return "medical-outline";
  if (kind === "edit") return "create-outline";
  if (kind === "staff") return "people-circle-outline";
  return "person-add-outline";
}

function ActivityRow({ item }: { item: ClinicActivityItem }) {
  const amount = money(item.amount);

  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            backgroundColor:
              item.tone === "success"
                ? colors.successSoft
                : item.tone === "warning"
                ? colors.warningSoft
                : item.tone === "danger"
                ? colors.dangerSoft
                : colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={iconForKind(item.kind)}
            size={21}
            color={
              item.tone === "success"
                ? colors.success
                : item.tone === "warning"
                ? colors.warning
                : item.tone === "danger"
                ? colors.danger
                : colors.primary
            }
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>{item.title}</Text>
          <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 19 }}>{item.subtitle}</Text>
        </View>

        <StatusBadge label={dateText(item.createdAt)} tone={item.tone} />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {item.patient ? <StatusBadge label={item.patient} /> : null}
        {item.staff ? <StatusBadge label={item.staff} tone="success" /> : null}
        {amount ? <StatusBadge label={amount} tone="success" /> : null}
      </View>
    </View>
  );
}

export default function ClinicActivityScreen() {
  const [range, setRange] = useState<ActivityRangeKey>("today");
  const [report, setReport] = useState<ClinicActivityReport | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(nextRange = range) {
    try {
      setLoading(true);
      const data = await buildClinicActivityReport(nextRange);
      setReport(data);
    } catch (error) {
      Alert.alert("Activity load failed", errorMessage(error));
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
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>Clinic Activity</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Owner view of who added patients, collected payments, uploaded files, entered tablets, booked appointments, and edited patient details.
        </Text>
      </View>

      <SectionCard title="Activity Range" subtitle="Use this for daily review or owner audit.">
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
            <StatCard label="Activity" value={loading ? "..." : report.summary.total} icon="pulse-outline" />
            <StatCard label="Payments" value={loading ? "..." : report.summary.payments} icon="cash-outline" tone="success" />
            <StatCard label="Visits" value={loading ? "..." : report.summary.visits} icon="clipboard-outline" />
            <StatCard label="Uploads" value={loading ? "..." : report.summary.uploads} icon="cloud-upload-outline" />
          </View>

          <SectionCard title="Latest Activity" subtitle={`Generated ${report.generatedAt} • ${report.rangeLabel}`}>
            {report.items.length ? (
              <View style={{ gap: 10 }}>
                {report.items.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </View>
            ) : (
              <EmptyState title="No activity found" message="Change the range or create new clinic records." icon="pulse-outline" />
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard>
          <EmptyState title="No activity loaded" message="Pull down to refresh and load owner activity." icon="pulse-outline" />
        </SectionCard>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton title="Refresh" icon="refresh-outline" variant="secondary" onPress={() => load(range)} loading={loading} style={{ flex: 1 }} />
        <AppButton title="Back to Report" icon="arrow-back-outline" variant="ghost" onPress={() => router.replace("/reports/clinic" as never)} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
