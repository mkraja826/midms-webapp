import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { ClinicBrandHeader } from "@/components/ClinicBrandHeader";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import {
  DashboardStats,
  getDashboardStats,
  getRoleLabel,
  getWorkflowDashboardSummary,
} from "@/lib/supabase";

type AppointmentRow = {
  id: string;
  patient_id: string;
  appointment_time: string;
  status?: string | null;
  patients?: {
    name?: string | null;
    phone?: string | null;
  } | null;
};

type IconName = ComponentProps<typeof Ionicons>["name"];

function money(value?: number | null) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function appointmentTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isWaitingStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  return ["scheduled", "waiting", "checked_in", "booked"].includes(value);
}

export default function ReceptionDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const [data, row] = await Promise.all([
        getDashboardStats(),
        getWorkflowDashboardSummary(),
      ]);
      setStats(data);
      setSummary(row);
    } catch (error) {
      Alert.alert(
        "Dashboard load failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const appointments = useMemo<AppointmentRow[]>(
    () => (stats?.todayAppointmentList ?? []) as AppointmentRow[],
    [stats?.todayAppointmentList]
  );
  const waiting = appointments.filter((item) => isWaitingStatus(item.status));
  const next = waiting[0];
  const waitingCount = summary?.waiting_count ?? waiting.length;
  const completedCount = summary?.completed_count ?? 0;
  const checkInCount = summary?.today_patient_count ?? waitingCount + completedCount;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <ClinicBrandHeader
        subtitle={`${getRoleLabel(profile?.role ?? "receptionist")} - Reception Desk`}
      />

      <View style={{ gap: 10 }}>
        <SectionTitle title="Start Here" subtitle="The most common reception actions." />
        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 24,
            padding: 14,
            gap: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Check-in patient"
            onPress={() => router.push("/reception/checkin" as never)}
            style={({ pressed }) => ({
              minHeight: 112,
              borderRadius: 24,
              padding: 16,
              backgroundColor: pressed ? colors.primaryDark : colors.primary,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            })}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 19,
                backgroundColor: "rgba(255,255,255,0.16)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="send-outline" size={27} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.white, fontSize: 19, fontWeight: "900" }}>
                Check-in Patient
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.76)", marginTop: 4, lineHeight: 19 }}>
                Register or select patient, handle OP fee, and send to doctor queue.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.white} />
          </Pressable>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <DeskAction
              title="Book"
              subtitle="Appointment"
              icon="calendar-number-outline"
              onPress={() => router.push("/appointment/book" as never)}
            />
            <DeskAction
              title="Payment"
              subtitle="Fees & dues"
              icon="cash-outline"
              onPress={() => router.push("/payment/fee" as never)}
            />
          </View>

          <AppButton
            title="Find Patient"
            icon="search-outline"
            variant="secondary"
            onPress={() => router.push("/patient" as never)}
          />
        </View>
      </View>

      {next ? (
        <View
          style={{
            borderRadius: 26,
            backgroundColor: colors.warningSoft,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: colors.text, fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}
              >
                Next Waiting Patient
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 2 }}
              >
                {next.patients?.name || "Patient"}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 2 }}>
                {appointmentTime(next.appointment_time)}
                {next.patients?.phone ? ` - ${next.patients.phone}` : ""}
              </Text>
            </View>
            <StatusBadge label="Waiting" tone="warning" />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <AppButton
              title="Open Patient"
              icon="person-circle-outline"
              onPress={() => router.push(`/patient/${next.patient_id}` as never)}
              style={{ flex: 1 }}
            />
            <AppButton
              title="Collect Fee"
              icon="cash-outline"
              variant="secondary"
              onPress={() => router.push("/payment/fee" as never)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <MetricCard label="OP Check-ins" value={loading ? "..." : checkInCount} icon="send-outline" />
        <MetricCard
          label="Waiting"
          value={loading ? "..." : waitingCount}
          icon="hourglass-outline"
          tone="warning"
        />
        <MetricCard
          label="Completed"
          value={loading ? "..." : completedCount}
          icon="checkmark-done-outline"
          tone="success"
        />
        <MetricCard
          label="Revenue"
          value={loading ? "..." : money(summary?.today_revenue ?? stats?.todayRevenue)}
          icon="cash-outline"
          tone="success"
        />
        <MetricCard
          label="Pending"
          value={loading ? "..." : money(summary?.pending_payments ?? stats?.pendingPayments)}
          icon="wallet-outline"
          tone="warning"
        />
        <MetricCard
          label="Appointments"
          value={loading ? "..." : stats?.todayAppointments ?? appointments.length}
          icon="calendar-number-outline"
        />
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle
          title="Waiting Room"
          subtitle={`${waiting.length} active waiting patient${waiting.length === 1 ? "" : "s"} today.`}
        />
        {waiting.length ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 20,
              overflow: "hidden",
            }}
          >
            {waiting.map((item, index) => (
              <WaitingRow
                key={item.id}
                item={item}
                isLast={index === waiting.length - 1}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            title="No waiting patients"
            message="Use Check-in Patient to send someone to the doctor queue."
            icon="people-outline"
          />
        )}
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="More Reception Work" subtitle="Secondary tools and account actions." />
        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          <ToolRow
            title="Pending Payments"
            subtitle="Collect old dues and treatment balances"
            icon="wallet-outline"
            onPress={() => router.push("/patient/payment" as never)}
          />
          <ToolRow
            title="Reminders"
            subtitle="Follow-ups due and pending payments"
            icon="notifications-outline"
            onPress={() => router.push("/reminders" as never)}
          />
          <ToolRow
            title="More Tools"
            subtitle="Old patient, gallery, account, and other fees"
            icon="grid-outline"
            onPress={() => router.push("/(reception)/more" as never)}
            isLast
          />
        </View>
      </View>
    </Screen>
  );
}

function DeskAction({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 102,
        borderRadius: 22,
        padding: 13,
        backgroundColor: pressed ? colors.surfaceSoft : colors.primarySoft,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "space-between",
      })}
    >
      <Ionicons name={icon} size={26} color={colors.primary} />
      <View>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{title}</Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  icon: IconName;
  tone?: "primary" | "success" | "warning";
}) {
  const backgroundColor =
    tone === "success"
      ? colors.successSoft
      : tone === "warning"
        ? colors.warningSoft
        : colors.surface;
  const foregroundColor =
    tone === "success"
      ? colors.success
      : tone === "warning"
        ? colors.warning
        : colors.primary;

  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: "47%",
        minHeight: 88,
        borderRadius: 20,
        padding: 13,
        backgroundColor,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: "space-between",
      }}
    >
      <Ionicons name={icon} size={21} color={foregroundColor} />
      <View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}
        >
          {value}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", marginTop: 2 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function WaitingRow({ item, isLast }: { item: AppointmentRow; isLast: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/patient/${item.patient_id}` as never)}
      style={({ pressed }) => ({
        minHeight: 72,
        paddingVertical: 11,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.surfaceSoft : colors.surface,
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
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
          {item.patients?.name || "Patient"}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>
          {appointmentTime(item.appointment_time)}
          {item.patients?.phone ? ` - ${item.patients.phone}` : ""}
        </Text>
      </View>
      <StatusBadge label={item.status || "Waiting"} tone="warning" />
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.muted, lineHeight: 19 }}>{subtitle}</Text> : null}
    </View>
  );
}

function ToolRow({
  title,
  subtitle,
  icon,
  onPress,
  isLast = false,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 68,
        paddingVertical: 11,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.surfaceSoft : colors.surface,
      })}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 15,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={21} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>
          {title}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}
