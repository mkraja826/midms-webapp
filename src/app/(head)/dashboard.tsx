import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { ClinicBrandHeader } from "@/components/ClinicBrandHeader";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { ClinicSubscription, getClinicSubscription, getSubscriptionDisplay } from "@/lib/subscription";
import { DashboardStats, getDashboardStats, getRoleLabel, getWorkflowDashboardSummary } from "@/lib/supabase";

type AppointmentRow = any;
type IconName = ComponentProps<typeof Ionicons>["name"];

function money(value?: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function appointmentTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isWaitingStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  return ["scheduled", "waiting", "checked_in", "booked"].includes(value);
}

function toneColors(tone: "success" | "warning" | "danger") {
  if (tone === "danger") {
    return {
      background: colors.dangerSoft,
      icon: colors.danger,
      border: "#FECACA",
    };
  }

  if (tone === "warning") {
    return {
      background: colors.warningSoft,
      icon: colors.warning,
      border: "#FDE68A",
    };
  }

  return {
    background: colors.successSoft,
    icon: colors.success,
    border: "#A7F3D0",
  };
}

function MoneyCard({
  label,
  value,
  icon,
  warning,
}: {
  label: string;
  value: string;
  icon: IconName;
  warning?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 24,
        padding: 16,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 12, textTransform: "uppercase" }}>
          {label}
        </Text>
        <Ionicons name={icon} size={22} color={warning ? colors.warning : colors.success} />
      </View>

      <Text style={{ color: colors.text, fontSize: 27, fontWeight: "900", marginTop: 12 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: IconName;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "46%",
        borderRadius: 18,
        padding: 12,
        backgroundColor: colors.surfaceSoft,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={19} color={colors.primary} />
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 8 }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: 2 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function QuickAction({
  title,
  icon,
  onPress,
  primary,
}: {
  title: string;
  icon: IconName;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: "48%",
        borderRadius: 20,
        padding: 14,
        minHeight: 96,
        backgroundColor: primary ? colors.primary : pressed ? colors.surfaceSoft : colors.background,
        borderWidth: 1,
        borderColor: primary ? colors.primary : colors.border,
        justifyContent: "space-between",
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <Ionicons name={icon} size={24} color={primary ? "#fff" : colors.primary} />
      <Text style={{ color: primary ? "#fff" : colors.text, fontWeight: "900", fontSize: 14 }} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function HeadDashboard() {
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [subscription, setSubscription] = useState<ClinicSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const data = await getDashboardStats();
      setStats(data);

      const row = await getWorkflowDashboardSummary();
      if (row) setSummary(row);

      const plan = await getClinicSubscription();
      setSubscription(plan);
    } catch (error) {
      Alert.alert("Dashboard load failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function logout() {
    try {
      await signOut();
    } catch (error) {
      Alert.alert("Logout failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  const appointments = useMemo(() => stats?.todayAppointmentList ?? [], [stats?.todayAppointmentList]);
  const waiting = appointments.filter((item: AppointmentRow) => isWaitingStatus(item.status));

  const todayRevenue = summary?.today_revenue ?? stats?.todayRevenue;
  const pendingPayments = summary?.pending_payments ?? stats?.pendingPayments;
  const waitingCount = summary?.waiting_count ?? waiting.length;
  const completedCount = summary?.completed_count ?? 0;
  const subscriptionInfo = getSubscriptionDisplay(subscription);
  const subscriptionTone = toneColors(subscriptionInfo.tone);

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <ClinicBrandHeader
        showManage
        subtitle={`${getRoleLabel(profile?.role ?? "head_doctor")} • Owner Dashboard`}
      />

      <View
        style={{
          borderRadius: 28,
          padding: 18,
          backgroundColor: colors.primary,
          gap: 8,
        }}
      >
        <Text style={{ color: "rgba(255,255,255,0.75)", fontWeight: "900", fontSize: 12, textTransform: "uppercase" }}>
          Today Clinic Pulse
        </Text>
        <Text style={{ color: "#fff", fontSize: 25, fontWeight: "900" }}>
          {loading ? "Loading..." : `${waitingCount} waiting • ${completedCount} completed`}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.76)", fontWeight: "700" }}>
          Quick owner view. Detailed breakdown is inside Clinic Report.
        </Text>
      </View>

      <SectionCard title="Subscription" subtitle="Trial and renewal status for this clinic.">
        <View
          style={{
            borderRadius: 22,
            padding: 14,
            backgroundColor: subscriptionTone.background,
            borderWidth: 1,
            borderColor: subscriptionTone.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              backgroundColor: colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="calendar-outline" size={23} color={subscriptionTone.icon} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
              {loading ? "Checking subscription..." : subscriptionInfo.title}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 19 }}>
              {loading ? "Please wait while we load clinic trial details." : subscriptionInfo.subtitle}
            </Text>
          </View>
        </View>
      </SectionCard>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <MoneyCard label="Revenue" value={loading ? "..." : money(todayRevenue)} icon="cash-outline" />
        <MoneyCard label="Pending" value={loading ? "..." : money(pendingPayments)} icon="wallet-outline" warning />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <MiniStat label="Waiting" value={loading ? "..." : waitingCount} icon="hourglass-outline" />
        <MiniStat label="Completed" value={loading ? "..." : completedCount} icon="checkmark-done-outline" />
        <MiniStat label="Patients Today" value={loading ? "..." : summary?.today_patient_count ?? 0} icon="people-outline" />
        <MiniStat label="Total Patients" value={loading ? "..." : stats?.totalPatients ?? 0} icon="person-outline" />
      </View>

      <SectionCard title="Quick Actions" subtitle="Most-used owner controls.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
          <QuickAction primary title="Clinic Report" icon="analytics-outline" onPress={() => router.push("/reports/clinic" as never)} />
          <QuickAction title="Check-in" icon="send-outline" onPress={() => router.push("/reception/checkin" as never)} />
          <QuickAction title="Patient Search" icon="search-outline" onPress={() => router.push("/patient" as never)} />
          <QuickAction title="Book Appointment" icon="calendar-number-outline" onPress={() => router.push("/appointment/book" as never)} />
          <QuickAction title="Reminders" icon="notifications-outline" onPress={() => router.push("/reminders" as never)} />
          <QuickAction title="Staff" icon="people-circle-outline" onPress={() => router.push("/staff" as never)} />
          <QuickAction title="Legal & Account" icon="shield-checkmark-outline" onPress={() => router.push("/settings/legal" as never)} />
        </View>
      </SectionCard>

      <SectionCard title="Waiting Queue" subtitle="Only latest 3 patients shown here.">
        {waiting.length ? (
          <View style={{ gap: 10 }}>
            {waiting.slice(0, 3).map((item: AppointmentRow) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/patient/${item.patient_id}` as never)}
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
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 16,
                    backgroundColor: colors.warningSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="time-outline" size={21} color={colors.warning} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
                    {item.patients?.name || "Patient"}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>
                    {appointmentTime(item.appointment_time)}
                    {item.patients?.phone ? ` • ${item.patients.phone}` : ""}
                  </Text>
                </View>

                <StatusBadge label={item.status || "Waiting"} tone="warning" />
              </Pressable>
            ))}

            {waiting.length > 3 ? (
              <AppButton
                title={`View all ${waiting.length}`}
                icon="list-outline"
                variant="secondary"
                onPress={() => router.push("/patient" as never)}
              />
            ) : null}
          </View>
        ) : (
          <EmptyState title="No waiting patients" message="Reception check-ins will appear here." icon="checkmark-done-outline" />
        )}
      </SectionCard>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton title="Refresh" icon="refresh-outline" variant="secondary" onPress={load} loading={loading} style={{ flex: 1 }} />
        <AppButton title="Logout" icon="log-out-outline" variant="ghost" onPress={logout} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
