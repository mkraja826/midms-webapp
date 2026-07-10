import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import {
  buildFollowupReview,
  buildFollowupWhatsAppMessage,
  FollowupRangeKey,
  FollowupReviewItem,
  FollowupReviewReport,
} from "@/lib/followupReview";

const RANGE_OPTIONS: { key: FollowupRangeKey; title: string; subtitle: string }[] = [
  { key: "today", title: "Today", subtitle: "Due now" },
  { key: "tomorrow", title: "Tomorrow", subtitle: "Plan ahead" },
  { key: "week", title: "7 Days", subtitle: "Upcoming" },
  { key: "overdue", title: "Overdue", subtitle: "Needs action" },
  { key: "all", title: "All", subtitle: "Open list" },
];

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Please try again.";
}

function cleanPhone(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function dueText(value?: string | null) {
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

function toneLabel(item: FollowupReviewItem) {
  if (item.status === "overdue") return "Overdue";
  if (item.status === "today") return "Today";
  return "Upcoming";
}

async function whatsappPatient(item: FollowupReviewItem) {
  const phone = cleanPhone(item.patientPhone);

  if (!phone) {
    Alert.alert("Phone missing", "This patient does not have a phone number saved.");
    return;
  }

  const message = encodeURIComponent(buildFollowupWhatsAppMessage(item));
  await Linking.openURL(`https://wa.me/${phone}?text=${message}`);
}

async function callPatient(item: FollowupReviewItem) {
  const phone = cleanPhone(item.patientPhone);

  if (!phone) {
    Alert.alert("Phone missing", "This patient does not have a phone number saved.");
    return;
  }

  await Linking.openURL(`tel:${phone}`);
}

export default function FollowupReviewScreen() {
  const [range, setRange] = useState<FollowupRangeKey>("today");
  const [report, setReport] = useState<FollowupReviewReport | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(nextRange = range) {
    try {
      setLoading(true);
      const data = await buildFollowupReview(nextRange);
      setReport(data);
    } catch (error) {
      Alert.alert("Follow-up review failed", errorMessage(error));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range);
  }, [range]);

  const items = useMemo(() => report?.items ?? [], [report?.items]);

  return (
    <Screen refreshing={loading} onRefresh={() => load(range)}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Follow-up Review
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Owner view for due follow-ups and scheduled appointments. Only current clinic patients are shown.
        </Text>
      </View>

      <SectionCard title="Range" subtitle="Choose which follow-ups owner wants to verify.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {RANGE_OPTIONS.map((item) => {
            const selected = range === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setRange(item.key)}
                style={({ pressed }) => ({
                  width: "47%",
                  minHeight: 82,
                  borderRadius: 20,
                  padding: 12,
                  backgroundColor: selected ? colors.primary : colors.background,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  justifyContent: "space-between",
                  opacity: pressed ? 0.84 : 1,
                })}
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
            <StatCard label="Total" value={loading ? "..." : report.summary.total} icon="calendar-outline" />
            <StatCard label="Overdue" value={loading ? "..." : report.summary.overdue} icon="alert-circle-outline" tone="danger" />
            <StatCard label="Today" value={loading ? "..." : report.summary.today} icon="time-outline" tone="warning" />
            <StatCard label="Appointments" value={loading ? "..." : report.summary.appointments} icon="calendar-number-outline" />
          </View>

          <SectionCard title="Due List" subtitle={`Generated ${report.generatedAt} • ${report.rangeLabel}`}>
            {items.length ? (
              <View style={{ gap: 12 }}>
                {items.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      borderRadius: 22,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      padding: 14,
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: item.tone === "danger" ? colors.dangerSoft : item.tone === "warning" ? colors.warningSoft : colors.primarySoft,
                        }}
                      >
                        <Ionicons
                          name={item.source === "appointment" ? "calendar-number-outline" : "repeat-outline"}
                          size={22}
                          color={item.tone === "danger" ? colors.danger : item.tone === "warning" ? colors.warning : colors.primary}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                            {item.patientName}
                          </Text>
                          <StatusBadge label={toneLabel(item)} tone={item.tone} />
                        </View>
                        <Text style={{ color: colors.muted, marginTop: 3 }}>
                          {item.patientPhone || "No phone"}{item.patientCode ? ` • ${item.patientCode}` : ""}
                        </Text>
                      </View>
                    </View>

                    <View style={{ gap: 4 }}>
                      <Text style={{ color: colors.text, fontWeight: "900" }}>{item.title}</Text>
                      <Text style={{ color: colors.muted, lineHeight: 20 }}>{item.subtitle}</Text>
                      <Text style={{ color: colors.muted, lineHeight: 20 }}>Due: {dueText(item.dueAt)}</Text>
                      <Text style={{ color: colors.muted, lineHeight: 20 }}>Staff: {item.staffName}</Text>
                    </View>

                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      <AppButton
                        title="WhatsApp"
                        icon="logo-whatsapp"
                        onPress={() => whatsappPatient(item)}
                        style={{ flex: 1, minWidth: "30%" }}
                      />
                      <AppButton
                        title="Call"
                        icon="call-outline"
                        variant="secondary"
                        onPress={() => callPatient(item)}
                        style={{ flex: 1, minWidth: "30%" }}
                      />
                      <AppButton
                        title="Patient"
                        icon="person-outline"
                        variant="ghost"
                        onPress={() => router.push(`/patient/${item.patientId}` as never)}
                        style={{ flex: 1, minWidth: "30%" }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState
                title="No follow-ups found"
                message="There are no open follow-ups or appointments for this range."
                icon="calendar-outline"
              />
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard>
          <EmptyState title="No review loaded" message="Pull down to refresh and load follow-ups." icon="repeat-outline" />
        </SectionCard>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton title="Refresh" icon="refresh-outline" variant="secondary" onPress={() => load(range)} loading={loading} style={{ flex: 1 }} />
        <AppButton title="Clinic Report" icon="arrow-back-outline" variant="ghost" onPress={() => router.replace("/reports/clinic" as never)} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
