import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { ActionCard } from "@/components/ActionCard";
import { AppButton } from "@/components/AppButton";
import { ClinicBrandHeader } from "@/components/ClinicBrandHeader";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowBottomNav } from "@/components/WorkflowBottomNav";
import { colors } from "@/constants/colors";
import { receptionWorkflowNavItems } from "@/constants/workflowNav";
import { useAuth } from "@/lib/auth";
import {
  ClinicFeatureSettings,
  DEFAULT_CLINIC_FEATURE_SETTINGS,
  getClinicFeatureSettings,
} from "@/lib/clinicOptions";
import {
  closeWaitingAppointment,
  DashboardStats,
  getDashboardStats,
  getRoleLabel,
  getWorkflowDashboardSummary,
  rescheduleAppointment,
  supabase,
} from "@/lib/supabase";

type AppointmentRow = {
  id: string;
  patient_id: string;
  appointment_time: string;
  status?: string | null;
  patients?: {
    id?: string;
    name?: string | null;
    phone?: string | null;
    photo_url?: string | null;
  } | null;
};

function money(value?: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function appointmentTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function appointmentDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nextFutureSameTime(value: string, daysToAdd = 1) {
  const date = new Date(value);
  date.setDate(date.getDate() + daysToAdd);

  while (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function isWaitingStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  return ["scheduled", "waiting", "checked_in", "booked"].includes(value);
}

function tone(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (["completed", "done"].includes(value)) return "success";
  if (["cancelled", "canceled"].includes(value)) return "danger";
  if (isWaitingStatus(value)) return "warning";
  return undefined;
}

export default function ReceptionDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [features, setFeatures] = useState<ClinicFeatureSettings>(DEFAULT_CLINIC_FEATURE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);

  async function load(force = false) {
    try {
      setLoading(true);

      const [data, row, featureSettings] = await Promise.all([
        getDashboardStats({ force }),
        getWorkflowDashboardSummary({ force }),
        getClinicFeatureSettings().catch((error) => {
          console.warn("Reception optional features load failed:", error);
          return DEFAULT_CLINIC_FEATURE_SETTINGS;
        }),
      ]);

      setFeatures(featureSettings);

      const { data: appointmentRows, error: appointmentError } = await supabase
        .from("appointments")
        .select("id,patient_id,appointment_time,status,patients(id,name,phone,photo_url)")
        .gte("appointment_time", startOfToday())
        .lte("appointment_time", endOfToday())
        .in("status", ["scheduled", "waiting", "checked_in", "booked"])
        .order("appointment_time", { ascending: true });

      if (!appointmentError && Array.isArray(appointmentRows)) {
        setStats({ ...data, todayAppointmentList: appointmentRows as any });
      } else {
        if (appointmentError) console.warn("Reception photo appointment query failed:", appointmentError.message);
        setStats(data);
      }

      if (row) setSummary(row);
    } catch (error) {
      Alert.alert("Dashboard load failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function performReschedule(item: AppointmentRow, nextTime: Date) {
    try {
      setBusyAppointmentId(item.id);
      await rescheduleAppointment(
        item.id,
        nextTime.toISOString(),
        `Rescheduled by reception from ${appointmentDateTime(item.appointment_time)} to ${appointmentDateTime(nextTime.toISOString())}.`
      );
      await load(true);
    } catch (error) {
      Alert.alert("Reschedule failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusyAppointmentId(null);
    }
  }

  function confirmReschedule(item: AppointmentRow) {
    const nextTime = nextFutureSameTime(item.appointment_time, 1);
    const name = item.patients?.name || "this patient";

    Alert.alert(
      "Reschedule appointment",
      `Move ${name} to ${appointmentDateTime(nextTime.toISOString())}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reschedule",
          onPress: () => void performReschedule(item, nextTime),
        },
      ]
    );
  }

  async function performCloseWaiting(item: AppointmentRow) {
    try {
      setBusyAppointmentId(item.id);
      await closeWaitingAppointment(
        item.id,
        `Closed by reception as no-show on ${appointmentDateTime(new Date().toISOString())}.`
      );
      await load(true);
    } catch (error) {
      Alert.alert("Close waiting failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusyAppointmentId(null);
    }
  }

  function confirmCloseWaiting(item: AppointmentRow) {
    const name = item.patients?.name || "this patient";

    Alert.alert(
      "Close waiting?",
      `${name} will be marked as no-show and removed from the waiting queue.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close waiting",
          style: "destructive",
          onPress: () => void performCloseWaiting(item),
        },
      ]
    );
  }

  const appointments = useMemo<AppointmentRow[]>(
    () => ((stats?.todayAppointmentList ?? []) as AppointmentRow[]),
    [stats?.todayAppointmentList]
  );
  const waiting = appointments.filter((item) => isWaitingStatus(item.status));
  const next = waiting[0];
  const appointmentCount = stats?.todayAppointments ?? appointments.length;
  const waitingCount = summary?.waiting_count ?? waiting.length;
  const completedCount = summary?.completed_count ?? 0;
  const opCheckInCount = summary?.today_patient_count ?? waitingCount + completedCount;

  return (
    <Screen
      refreshing={loading}
      onRefresh={() => load(true)}
      bottomBar={<WorkflowBottomNav items={receptionWorkflowNavItems} activeKey="home" />}
    >
      <ClinicBrandHeader subtitle={`${getRoleLabel(profile?.role ?? "receptionist")} • Reception Desk`} />

      <SectionCard>
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: "900" }}>
            Start Here
          </Text>

          <ActionCard
            title="Check-in Patient"
            subtitle="Register/select patient, handle OP fee, send to doctor queue"
            icon="send-outline"
            onPress={() => router.push("/reception/checkin" as never)}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Book appointment"
              onPress={() => router.push("/appointment/book" as never)}
              style={{
                flex: 1,
                minHeight: 102,
                borderRadius: 22,
                padding: 13,
                backgroundColor: colors.primarySoft,
                borderWidth: 1,
                borderColor: colors.border,
                justifyContent: "space-between",
              }}
            >
              <Ionicons name="calendar-number-outline" size={26} color={colors.primary} />
              <View>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Book</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>Appointment</Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Collect payment"
              onPress={() => router.push("/payment/fee" as never)}
              style={{
                flex: 1,
                minHeight: 102,
                borderRadius: 22,
                padding: 13,
                backgroundColor: colors.primarySoft,
                borderWidth: 1,
                borderColor: colors.border,
                justifyContent: "space-between",
              }}
            >
              <Ionicons name="cash-outline" size={26} color={colors.primary} />
              <View>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Payment</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>Fees & dues</Text>
              </View>
            </Pressable>
          </View>
          <ActionCard
            title="Find Patient"
            subtitle="Open history, payments, files, visits, and patient actions"
            icon="search-outline"
            onPress={() => router.push("/patient" as never)}
          />
          <AppButton
            title="More Tools"
            icon="grid-outline"
            variant="secondary"
            onPress={() => router.push("/(reception)/more" as never)}
          />
        </View>
      </SectionCard>

      {next ? (
        <SectionCard>
          <View
            style={{
              borderRadius: 24,
              backgroundColor: colors.warningSoft,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PatientAvatar
                photoUrl={features.enable_patient_photos ? next.patients?.photo_url : null}
                warning
                size={48}
              />

              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>
                  Next Waiting Patient
                </Text>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 2 }}>
                  {next.patients?.name || "Patient"}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>
                  {appointmentTime(next.appointment_time)}
                  {next.patients?.phone ? ` • ${next.patients.phone}` : ""}
                </Text>
              </View>

              <StatusBadge label={next.status || "Waiting"} tone="warning" />
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <AppButton
                title="Open Patient"
                icon="person-circle-outline"
                onPress={() => router.push(`/patient/${next.patient_id}` as never)}
                style={{ flex: 1 }}
              />
              {features.enable_prescription_medications ? (
                <AppButton
                  title="Add Tablets"
                  icon="medical-outline"
                  variant="secondary"
                  onPress={() => router.push({ pathname: "/patient/medications", params: { patient_id: next.patient_id } } as never)}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <AppButton
                title="Move Tomorrow"
                icon="calendar-number-outline"
                variant="secondary"
                loading={busyAppointmentId === next.id}
                onPress={() => confirmReschedule(next)}
                style={{ flex: 1 }}
              />
              <AppButton
                title="No-show"
                icon="close-circle-outline"
                variant="secondary"
                loading={busyAppointmentId === next.id}
                onPress={() => confirmCloseWaiting(next)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </SectionCard>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="OP Check-ins" value={loading ? "..." : opCheckInCount} icon="send-outline" />
        <StatCard label="Appointments" value={loading ? "..." : appointmentCount} icon="calendar-number-outline" />
        <StatCard label="Waiting" value={loading ? "..." : waitingCount} icon="hourglass-outline" tone="warning" />
        <StatCard label="Completed" value={loading ? "..." : completedCount} icon="checkmark-done-outline" tone="success" />
        <StatCard label="Revenue" value={loading ? "..." : money(summary?.today_revenue ?? stats?.todayRevenue)} icon="cash-outline" tone="success" />
        <StatCard label="Pending" value={loading ? "..." : money(summary?.pending_payments ?? stats?.pendingPayments)} icon="wallet-outline" tone="warning" />
      </View>

      <SectionCard title="Waiting Room" subtitle={`${waiting.length} active waiting patient${waiting.length === 1 ? "" : "s"} today.`}>
        {waiting.length ? (
          <View style={{ gap: 10 }}>
            {waiting.map((item) => (
              <AppointmentItem
                key={item.id}
                item={item}
                showPhoto={features.enable_patient_photos}
                showMedication={features.enable_prescription_medications}
                busy={busyAppointmentId === item.id}
                onPress={() => router.push(`/patient/${item.patient_id}` as never)}
                onReschedule={() => confirmReschedule(item)}
                onCloseWaiting={() => confirmCloseWaiting(item)}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No waiting patients" message="Use Quick Check-in to send patient to doctor queue." icon="people-outline" />
        )}
      </SectionCard>
    </Screen>
  );
}

function AppointmentItem({
  item,
  onPress,
  onReschedule,
  onCloseWaiting,
  showPhoto,
  showMedication,
  busy,
}: {
  item: AppointmentRow;
  onPress: () => void;
  onReschedule: () => void;
  onCloseWaiting: () => void;
  showPhoto: boolean;
  showMedication: boolean;
  busy: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 18,
        backgroundColor: pressed ? colors.surfaceSoft : colors.background,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <PatientAvatar photoUrl={showPhoto ? item.patients?.photo_url : null} />

      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          {item.patients?.name || "Patient"}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>
          {appointmentTime(item.appointment_time)}
          {item.patients?.phone ? ` • ${item.patients.phone}` : ""}
        </Text>
      </View>

      {showMedication ? (
        <Pressable
          onPress={() => router.push({ pathname: "/patient/medications", params: { patient_id: item.patient_id } } as never)}
          hitSlop={8}
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="medical-outline" size={18} color={colors.primary} />
        </Pressable>
      ) : null}

      <Pressable
        disabled={busy}
        onPress={onReschedule}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Move appointment to tomorrow"
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          opacity: busy ? 0.55 : 1,
        }}
      >
        <Ionicons name="calendar-number-outline" size={18} color={colors.primary} />
      </Pressable>

      <Pressable
        disabled={busy}
        onPress={onCloseWaiting}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close waiting as no-show"
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          backgroundColor: colors.warningSoft,
          alignItems: "center",
          justifyContent: "center",
          opacity: busy ? 0.55 : 1,
        }}
      >
        <Ionicons name="close-circle-outline" size={18} color={colors.warning} />
      </Pressable>

      <StatusBadge label={item.status || "Waiting"} tone={tone(item.status) as any} />
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function PatientAvatar({
  photoUrl,
  warning = false,
  size = 46,
}: {
  photoUrl?: string | null;
  warning?: boolean;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.37),
        backgroundColor: warning ? colors.warningSoft : colors.primarySoft,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <Ionicons name={warning ? "time-outline" : "person-outline"} size={22} color={warning ? colors.warning : colors.primary} />
      )}
    </View>
  );
}
