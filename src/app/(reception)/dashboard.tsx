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

function tone(status?: string | null) {
  const value = String(status || "").toLowerCase();
  if (["completed", "done"].includes(value)) return "success";
  if (["cancelled", "canceled"].includes(value)) return "danger";
  if (isWaitingStatus(value)) return "warning";
  return undefined;
}

export default function ReceptionDashboard() {
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
  const next = waiting[0];

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <ClinicBrandHeader subtitle={`${getRoleLabel(profile?.role ?? "receptionist")} • Reception Desk`} />

      <SectionCard>
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 19, fontWeight: "900" }}>
            Quick Actions
          </Text>

          <ActionCard
            title="Quick Check-in + OP Fee"
            subtitle="Register/select patient, collect ₹300, send to doctor queue"
            icon="send-outline"
            onPress={() => router.push("/reception/checkin" as never)}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => router.push({ pathname: "/payment/fee", params: { fee_type: "op_fee" } } as never)}
              style={{
                flex: 1,
                minHeight: 102,
                borderRadius: 22,
                padding: 13,
                backgroundColor: colors.successSoft,
                borderWidth: 1,
                borderColor: colors.border,
                justifyContent: "space-between",
              }}
            >
              <Ionicons name="receipt-outline" size={26} color={colors.success} />
              <View>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>OP Fee</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>₹300 default</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push({ pathname: "/payment/fee", params: { fee_type: "xray_fee" } } as never)}
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
              <Ionicons name="scan-outline" size={26} color={colors.primary} />
              <View>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>X-ray Fee</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>Separate X-ray amount</Text>
              </View>
            </Pressable>
          </View>
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
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 18,
                  backgroundColor: colors.warning,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="time-outline" size={24} color={colors.white} />
              </View>

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

            <AppButton
              title="Open Patient"
              icon="person-circle-outline"
              onPress={() => router.push(`/patient/${next.patient_id}` as never)}
            />
          </View>
        </SectionCard>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="Waiting" value={loading ? "..." : summary?.waiting_count ?? waiting.length} icon="hourglass-outline" tone="warning" />
        <StatCard label="Completed" value={loading ? "..." : summary?.completed_count ?? 0} icon="checkmark-done-outline" tone="success" />
        <StatCard label="Revenue" value={loading ? "..." : money(summary?.today_revenue ?? stats?.todayRevenue)} icon="cash-outline" tone="success" />
        <StatCard label="Pending" value={loading ? "..." : money(summary?.pending_payments ?? stats?.pendingPayments)} icon="wallet-outline" tone="warning" />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="OP Fees" value={loading ? "..." : money(summary?.op_fee_revenue_today)} icon="receipt-outline" tone="success" />
        <StatCard label="X-ray" value={loading ? "..." : money(summary?.xray_revenue_today)} icon="scan-outline" />
        <StatCard label="Medication" value={loading ? "..." : money(summary?.medication_revenue_today)} icon="medical-outline" />
        <StatCard label="Treatment" value={loading ? "..." : money(summary?.treatment_revenue_today)} icon="hammer-outline" tone="success" />
        <StatCard label="Pending Paid" value={loading ? "..." : money(summary?.pending_collected_today)} icon="checkmark-circle-outline" tone="success" />
        <StatCard label="Other" value={loading ? "..." : money(summary?.other_revenue_today)} icon="wallet-outline" />
      </View>

      <SectionCard title="Quick Desk" subtitle="Daily reception actions for check-in, fees, appointments, and reminders.">
        <ActionCard title="Book Appointment" subtitle="For WhatsApp/call/online enquiries" icon="calendar-number-outline" onPress={() => router.push("/appointment/book" as never)} />
        <ActionCard title="Add Old Patient" subtitle="Enter previous clinic records and old pending balance" icon="archive-outline" onPress={() => router.push("/patient/add-old" as never)} />
        <ActionCard title="Search Patient" subtitle="Open patient history or collect fee" icon="search-outline" onPress={() => router.push("/patient" as never)} />
        <ActionCard title="Medication / Treatment Fee" subtitle="Collect medicine, treatment, or other fee" icon="cash-outline" onPress={() => router.push({ pathname: "/payment/fee", params: { fee_type: "medication_fee" } } as never)} />
        <ActionCard title="Gallery" subtitle="View X-rays, prescriptions, reports and photos" icon="images-outline" onPress={() => router.push("/gallery" as never)} />
        <ActionCard title="Collect Pending Payment" subtitle="Old due or treatment balance" icon="wallet-outline" onPress={() => router.push("/patient/payment" as never)} />
        <ActionCard title="Reminders" subtitle="Follow-ups due and pending payments" icon="notifications-outline" onPress={() => router.push("/reminders" as never)} />
        <ActionCard title="Change Password" subtitle="Update your login password" icon="key-outline" onPress={() => router.push("/settings/change-password" as never)} />
      </SectionCard>

      <SectionCard title="Waiting Room" subtitle="Patients waiting for doctor visit will appear here.">
        {waiting.length ? (
          <View style={{ gap: 10 }}>
            {waiting.slice(0, 8).map((item: AppointmentRow) => (
              <AppointmentItem key={item.id} item={item} onPress={() => router.push(`/patient/${item.patient_id}` as never)} />
            ))}
          </View>
        ) : (
          <EmptyState title="No waiting patients" message="Use Quick Check-in to send patient to doctor queue." icon="people-outline" />
        )}
      </SectionCard>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton title="Refresh" icon="refresh-outline" variant="secondary" onPress={load} loading={loading} style={{ flex: 1 }} />
        <AppButton title="Logout" icon="log-out-outline" variant="ghost" onPress={logout} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

function AppointmentItem({ item, onPress }: { item: AppointmentRow; onPress: () => void }) {
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

      <StatusBadge label={item.status || "Waiting"} tone={tone(item.status) as any} />
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

