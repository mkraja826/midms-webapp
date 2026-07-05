import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { ActionCard } from "@/components/ActionCard";
import { AppButton } from "@/components/AppButton";
import { ClinicBrandHeader } from "@/components/ClinicBrandHeader";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { DashboardStats, getDashboardStats, getRoleLabel, getWorkflowDashboardSummary } from "@/lib/supabase";

type AppointmentRow = any;

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

export default function HeadDashboard() {
  const { profile, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);

      const data = await getDashboardStats();
      setStats(data);

      const row = await getWorkflowDashboardSummary();
      if (row) setSummary(row);
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

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <ClinicBrandHeader
        showManage
        subtitle={`${getRoleLabel(profile?.role ?? "head_doctor")} • Owner Dashboard`}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="Revenue" value={loading ? "..." : money(summary?.today_revenue ?? stats?.todayRevenue)} icon="cash-outline" tone="success" />
        <StatCard label="Pending" value={loading ? "..." : money(summary?.pending_payments ?? stats?.pendingPayments)} icon="wallet-outline" tone="warning" />
        <StatCard label="Waiting" value={loading ? "..." : summary?.waiting_count ?? waiting.length} icon="hourglass-outline" tone="warning" />
        <StatCard label="Completed" value={loading ? "..." : summary?.completed_count ?? 0} icon="checkmark-done-outline" tone="success" />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="OP Fees" value={loading ? "..." : money(summary?.op_fee_revenue_today)} icon="receipt-outline" tone="success" />
        <StatCard label="X-ray" value={loading ? "..." : money(summary?.xray_revenue_today)} icon="scan-outline" />
        <StatCard label="Medication" value={loading ? "..." : money(summary?.medication_revenue_today)} icon="medical-outline" />
        <StatCard label="Treatment" value={loading ? "..." : money(summary?.treatment_revenue_today)} icon="hammer-outline" tone="success" />
        <StatCard label="Pending Paid" value={loading ? "..." : money(summary?.pending_collected_today)} icon="checkmark-circle-outline" tone="success" />
        <StatCard label="Other" value={loading ? "..." : money(summary?.other_revenue_today)} icon="wallet-outline" />
        <StatCard label="Patients Today" value={loading ? "..." : summary?.today_patient_count ?? 0} icon="people-outline" />
        <StatCard label="Total Patients" value={loading ? "..." : stats?.totalPatients ?? 0} icon="person-outline" />
      </View>

      <SectionCard title="Owner Actions" subtitle="Clinic control panel for revenue, staff, patients, appointments, and follow-ups.">
        <ActionCard title="Reception Check-in" subtitle="Register/select patient + OP fee + waiting queue" icon="send-outline" onPress={() => router.push("/reception/checkin" as never)} />
        <ActionCard title="Add Old Patient" subtitle="Migrate old clinic files with history and opening due" icon="archive-outline" onPress={() => router.push("/patient/add-old" as never)} />
        <ActionCard title="Book Appointment" subtitle="For online/call enquiries" icon="calendar-number-outline" onPress={() => router.push("/appointment/book" as never)} />
        <ActionCard title="Patient Search" subtitle="View patients and history" icon="search-outline" onPress={() => router.push("/patient" as never)} />
        <ActionCard title="Reminders" subtitle="Follow-ups due and payment dues" icon="notifications-outline" onPress={() => router.push("/reminders" as never)} />
        <ActionCard title="Clinic Gallery" subtitle="View all X-rays, prescriptions and photos" icon="images-outline" onPress={() => router.push("/gallery" as never)} />
        <ActionCard title="Staff Management" subtitle="Invite doctor or receptionist" icon="people-circle-outline" onPress={() => router.push("/staff" as never)} />
        <ActionCard title="Subscription" subtitle="Monthly or yearly DMS clinic plan" icon="card-outline" onPress={() => router.push("/settings/subscription" as never)} />
        <ActionCard title="Change Password" subtitle="Update your login password" icon="key-outline" onPress={() => router.push("/settings/change-password" as never)} />
      </SectionCard>

      <SectionCard title="Live Waiting Queue" subtitle="Track patients currently waiting for doctor visit.">
        {waiting.length ? (
          <View style={{ gap: 10 }}>
            {waiting.slice(0, 8).map((item: AppointmentRow) => (
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
                    width: 46,
                    height: 46,
                    borderRadius: 17,
                    backgroundColor: colors.warningSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="time-outline" size={22} color={colors.warning} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
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
