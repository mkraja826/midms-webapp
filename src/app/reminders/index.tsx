import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";

type ReminderFilter = "overdue" | "today" | "tomorrow" | "upcoming";

type FollowupReminder = {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone?: string | null;
  patient_code?: string | null;
  appointment_time: string;
  status: string;
  notes?: string | null;
  reminder_state: ReminderFilter;
  reminder_status?: string | null;
};

type PendingPatient = {
  patient_id: string;
  patient_name: string;
  patient_phone?: string | null;
  patient_code?: string | null;
  pending_amount: number;
  invoice_count: number;
  last_invoice_id?: string | null;
  last_invoice_date?: string | null;
};

type Summary = {
  followups_today: number;
  followups_overdue: number;
  followups_tomorrow: number;
  pending_patients: number;
  pending_amount: number;
  waiting_count: number;
  completed_count: number;
};

const FILTERS: { key: ReminderFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "overdue", label: "Overdue", icon: "alert-circle-outline" },
  { key: "today", label: "Today", icon: "today-outline" },
  { key: "tomorrow", label: "Tomorrow", icon: "calendar-outline" },
  { key: "upcoming", label: "Upcoming", icon: "calendar-number-outline" },
];

function money(value?: number | string | null) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stateTone(state?: string): "success" | "warning" | "danger" | "primary" {
  if (state === "overdue") return "danger";
  if (state === "today") return "warning";
  if (state === "tomorrow") return "success";
  return "primary";
}

function getErrorMessage(error: unknown) {
  if (!error) return "Unknown error";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const err = error as { message?: string; details?: string; hint?: string; code?: string };
    return [
      err.message,
      err.details ? `Details: ${err.details}` : "",
      err.hint ? `Hint: ${err.hint}` : "",
      err.code ? `Code: ${err.code}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return "Unknown error";
}

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = 12000): Promise<T> {
  return await Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Request timed out. Check network and try again.")), timeoutMs);
    }),
  ]);
}

export default function RemindersScreen() {
  const [filter, setFilter] = useState<ReminderFilter>("today");
  const [search, setSearch] = useState("");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [followups, setFollowups] = useState<FollowupReminder[]>([]);
  const [pendingPatients, setPendingPatients] = useState<PendingPatient[]>([]);

  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  async function load(nextFilter = filter, nextSearch = search) {
    try {
      setLoading(true);

      const [summaryRes, followupsRes, pendingRes] = await Promise.all([
        withTimeout(supabase.rpc("get_reminder_summary"), 12000),
        withTimeout(
          supabase.rpc("get_followup_reminders", {
            p_filter: nextFilter,
            p_search: nextSearch.trim() || null,
          }),
          12000
        ),
        withTimeout(
          supabase.rpc("get_pending_payment_patients", {
            p_search: nextSearch.trim() || null,
          }),
          12000
        ),
      ]);

      if (summaryRes.error) throw summaryRes.error;
      if (followupsRes.error) throw followupsRes.error;
      if (pendingRes.error) throw pendingRes.error;

      const summaryRow = Array.isArray(summaryRes.data)
        ? summaryRes.data[0]
        : summaryRes.data;

      setSummary((summaryRow || null) as Summary | null);
      setFollowups((followupsRes.data || []) as FollowupReminder[]);
      setPendingPatients((pendingRes.data || []) as PendingPatient[]);
    } catch (error) {
      Alert.alert("Reminders load failed", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("today", "");
  }, []);

  async function changeFilter(next: ReminderFilter) {
    setFilter(next);
    await load(next, search);
  }

  async function markAppointment(appointmentId: string, status: string) {
    try {
      setMarkingId(appointmentId);

      const { error } = await withTimeout(
        supabase.rpc("update_followup_status", {
          p_appointment_id: appointmentId,
          p_status: status,
        }),
        12000
      );

      if (error) throw error;

      await load(filter, search);
    } catch (error) {
      Alert.alert("Update failed", getErrorMessage(error));
    } finally {
      setMarkingId(null);
    }
  }

  function callPatient(phone?: string | null) {
    if (!phone) {
      Alert.alert("No phone number", "This patient has no phone number.");
      return;
    }

    Linking.openURL(`tel:${phone}`);
  }

  function cleanIndianPhone(phone?: string | null) {
    const digits = String(phone || "").replace(/[^0-9]/g, "");

    if (!digits) return "";

    if (digits.length === 10) return `91${digits}`;

    return digits;
  }

  function whatsappPatient(phone?: string | null, message?: string) {
    const cleaned = cleanIndianPhone(phone);

    if (!cleaned) {
      Alert.alert("No phone number", "This patient has no phone number.");
      return;
    }

    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(
      message || "Hello, this is a reminder from our dental clinic."
    )}`;

    Linking.openURL(url);
  }

  function buildFollowupReminderMessage(item: FollowupReminder) {
    return `Hello ${item.patient_name}, this is a follow-up reminder from our dental clinic. Your follow-up is scheduled for ${formatDateTime(
      item.appointment_time
    )}. Please reply on WhatsApp or call us to confirm. Thank you.`;
  }

  function buildDueReminderMessage(patient: PendingPatient) {
    return `Hello ${patient.patient_name}, this is a payment due reminder from our dental clinic. Your pending amount is ${money(
      patient.pending_amount
    )}. Please reply on WhatsApp or contact reception for payment details. Thank you.`;
  }

  const totalFollowupAlerts = useMemo(
    () => Number(summary?.followups_today || 0) + Number(summary?.followups_overdue || 0),
    [summary]
  );

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Reminders
        </Text>

        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Follow-up reminders and due payment reminders in one place.
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard
          label="Due Today"
          value={loading ? "..." : summary?.followups_today ?? 0}
          icon="today-outline"
          tone="warning"
        />

        <StatCard
          label="Overdue"
          value={loading ? "..." : summary?.followups_overdue ?? 0}
          icon="alert-circle-outline"
          tone="danger"
        />

        <StatCard
          label="Due Patients"
          value={loading ? "..." : summary?.pending_patients ?? 0}
          icon="wallet-outline"
          tone="warning"
        />

        <StatCard
          label="Due Amount"
          value={loading ? "..." : money(summary?.pending_amount)}
          icon="cash-outline"
          tone="success"
        />
      </View>

      <SectionCard>
        <View
          style={{
            minHeight: 54,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            gap: 10,
          }}
        >
          <Ionicons name="search-outline" size={21} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search patient name, phone, or ID"
            placeholderTextColor={colors.muted}
            style={{
              flex: 1,
              minHeight: 54,
              color: colors.text,
              fontSize: 16,
            }}
            returnKeyType="search"
            onSubmitEditing={() => load(filter, search)}
          />

          <Pressable onPress={() => load(filter, search)}>
            <Ionicons name="arrow-forward-circle" size={27} color={colors.primary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {FILTERS.map((item) => {
            const selected = filter === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => changeFilter(item.key)}
                style={{
                  minHeight: 42,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : colors.background,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={selected ? colors.white : colors.primary}
                />
                <Text
                  style={{
                    color: selected ? colors.white : colors.text,
                    fontWeight: "900",
                    fontSize: 13,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <AppButton
            title="Refresh"
            icon="refresh-outline"
            variant="secondary"
            onPress={() => load(filter, search)}
            style={{ flex: 1 }}
          />

          <AppButton
            title="Collect Due"
            icon="wallet-outline"
            onPress={() => router.push("/patient/payment" as never)}
            style={{ flex: 1 }}
          />
        </View>
      </SectionCard>

      {totalFollowupAlerts > 0 ? (
        <SectionCard>
          <View
            style={{
              padding: 14,
              borderRadius: 22,
              backgroundColor: colors.warningSoft,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 6,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
              Attention needed
            </Text>

            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              You have {summary?.followups_today || 0} follow-up(s) today and{" "}
              {summary?.followups_overdue || 0} overdue follow-up(s).
            </Text>
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title="Follow-up Reminders">
        {loading ? (
          <Text style={{ color: colors.muted }}>Loading follow-ups...</Text>
        ) : followups.length ? (
          <View style={{ gap: 10 }}>
            {followups.map((item) => (
              <View
                key={item.appointment_id}
                style={{
                  padding: 12,
                  borderRadius: 20,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 18,
                      backgroundColor:
                        item.reminder_state === "overdue"
                          ? colors.dangerSoft
                          : colors.warningSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={item.reminder_state === "overdue" ? "alert-outline" : "calendar-outline"}
                      size={22}
                      color={item.reminder_state === "overdue" ? colors.danger : colors.warning}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
                      {item.patient_name}
                    </Text>

                    <Text style={{ color: colors.muted, marginTop: 2 }}>
                      {item.patient_phone || "No phone"}
                      {item.patient_code ? ` • ${item.patient_code}` : ""}
                    </Text>

                    <Text style={{ color: colors.muted, marginTop: 2 }}>
                      {formatDateTime(item.appointment_time)}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <StatusBadge label={item.reminder_state} tone={stateTone(item.reminder_state)} />
                    <StatusBadge label={item.reminder_status || "pending"} />
                  </View>
                </View>

                {item.notes ? (
                  <Text style={{ color: colors.muted, lineHeight: 19 }}>
                    {item.notes}
                  </Text>
                ) : null}

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <MiniButton
                    label="Call"
                    icon="call-outline"
                    onPress={() => callPatient(item.patient_phone)}
                  />

                  <MiniButton
                    label="WhatsApp"
                    icon="logo-whatsapp"
                    onPress={() =>
                      {
                        whatsappPatient(
                          item.patient_phone,
                          buildFollowupReminderMessage(item)
                        );
                        markAppointment(item.appointment_id, "message_sent");
                      }
                    }
                  />

                  <MiniButton
                    label="Confirmed"
                    icon="thumbs-up-outline"
                    loading={markingId === item.appointment_id}
                    onPress={() => markAppointment(item.appointment_id, "patient_confirmed")}
                  />

                  <MiniButton
                    label="No Reach"
                    icon="call-outline"
                    loading={markingId === item.appointment_id}
                    onPress={() => markAppointment(item.appointment_id, "not_reachable")}
                  />

                  <MiniButton
                    label="Patient"
                    icon="person-outline"
                    onPress={() => router.push(`/patient/${item.patient_id}` as never)}
                  />

                  <MiniButton
                    label="Done"
                    icon="checkmark-done-outline"
                    loading={markingId === item.appointment_id}
                    onPress={() => markAppointment(item.appointment_id, "completed")}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No follow-up reminders"
            message="Follow-up appointments from Add Visit and Book Appointment will appear here."
            icon="notifications-off-outline"
          />
        )}
      </SectionCard>

      <SectionCard title="Due Payment Reminders">
        {loading ? (
          <Text style={{ color: colors.muted }}>Loading due payments...</Text>
        ) : pendingPatients.length ? (
          <View style={{ gap: 10 }}>
            {pendingPatients.slice(0, 20).map((patient) => (
              <Pressable
                key={patient.patient_id}
                onPress={() =>
                  whatsappPatient(
                    patient.patient_phone,
                    buildDueReminderMessage(patient)
                  )
                }
                style={({ pressed }) => ({
                  padding: 12,
                  borderRadius: 20,
                  backgroundColor: pressed ? colors.surfaceSoft : colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                })}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 18,
                    backgroundColor: colors.warningSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="wallet-outline" size={22} color={colors.warning} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                    {patient.patient_name}
                  </Text>

                  <Text style={{ color: colors.muted, marginTop: 2 }}>
                    {patient.patient_phone || "No phone"}
                    {patient.patient_code ? ` • ${patient.patient_code}` : ""}
                  </Text>

                  <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
                    {patient.invoice_count} pending invoice{patient.invoice_count === 1 ? "" : "s"}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ color: colors.warning, fontWeight: "900", fontSize: 17 }}>
                    {money(patient.pending_amount)}
                  </Text>
                  <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 12 }}>
                    Collect
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No payment dues"
            message="Patients with pending invoice amount will appear here."
            icon="checkmark-done-outline"
          />
        )}
      </SectionCard>

      <AppButton
        title="Back"
        icon="arrow-back-outline"
        variant="ghost"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

function MiniButton({
  label,
  icon,
  onPress,
  loading = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={{
        minHeight: 38,
        borderRadius: 999,
        paddingHorizontal: 12,
        backgroundColor: colors.surfaceSoft,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: loading ? 0.55 : 1,
      }}
    >
      <Ionicons name={icon} size={15} color={colors.primary} />
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
        {loading ? "..." : label}
      </Text>
    </Pressable>
  );
}
