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
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import {
  ClinicFeatureSettings,
  DEFAULT_CLINIC_FEATURE_SETTINGS,
  getClinicFeatureSettings,
} from "@/lib/clinicOptions";
import {
  DashboardStats,
  getDashboardStats,
  getRoleLabel,
  getWorkflowDashboardSummary,
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

  async function load() {
    try {
      setLoading(true);

      const [data, row, featureSettings] = await Promise.all([
        getDashboardStats(),
        getWorkflowDashboardSummary(),
        getClinicFeatureSettings().catch((error) => {
          console.warn("Reception optional features load failed:", error);
          return DEFAULT_CLINIC_FEATURE_SETTINGS;
        }),
      ]);

      setFeatures(featureSettings);

      const { data: appointmentRows, error: appointmentError } = await supabase
        .from("appointments")
        .select("*, patients(id,name,phone,photo_url), profiles(id,name)")
        .gte("appointment_time", startOfToday())
        .lte("appointment_time", endOfToday())
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
    load();
  }, []);

  const appointments = useMemo<AppointmentRow[]>(
    () => ((stats?.todayAppointmentList ?? []) as AppointmentRow[]),
    [stats?.todayAppointmentList]
  );
  const waiting = appointments.filter((item) => isWaitingStatus(item.status));
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

      <SectionCard title="Quick Desk" subtitle="Daily reception actions for check-in, fees, appointments, reminders, and optional prescriptions.">
        <ActionCard title="Book Appointment" subtitle="For WhatsApp/call/online enquiries" icon="calendar-number-outline" onPress={() => router.push("/appointment/book" as never)} />
        <ActionCard title="Add Old Patient" subtitle="Enter previous clinic records and old pending balance" icon="archive-outline" onPress={() => router.push("/patient/add-old" as never)} />
        <ActionCard title="Search Patient" subtitle="Open patient history or collect fee" icon="search-outline" onPress={() => router.push("/patient" as never)} />
        <ActionCard title="Ongoing Treatments" subtitle="Open planned, ongoing and outstanding work" icon="construct-outline" onPress={() => router.push("/treatments/ongoing" as never)} />
        <ActionCard title="Medication / Treatment Fee" subtitle="Collect medicine, treatment, or other fee" icon="cash-outline" onPress={() => router.push({ pathname: "/payment/fee", params: { fee_type: "medication_fee" } } as never)} />
        {features.enable_prescription_medications ? (
          <ActionCard title="Add Prescribed Tablets" subtitle="Enter tablets prescribed by doctor; repeated medicines show for selection" icon="medical-outline" onPress={() => router.push("/patient/medications" as never)} />
        ) : null}
        <ActionCard title="Gallery" subtitle="View X-rays, prescriptions, reports and photos" icon="images-outline" onPress={() => router.push("/gallery" as never)} />
        <ActionCard title="Collect Pending Payment" subtitle="Old due or treatment balance" icon="wallet-outline" onPress={() => router.push("/patient/payment" as never)} />
        <ActionCard title="Reminders" subtitle="Follow-ups due and pending payments" icon="notifications-outline" onPress={() => router.push("/reminders" as never)} />
        <ActionCard title="Legal & Account" subtitle="Logout, privacy, support and account options" icon="shield-checkmark-outline" onPress={() => router.push("/settings/legal" as never)} />
        <ActionCard title="Change Password" subtitle="Update your login password" icon="key-outline" onPress={() => router.push("/settings/change-password" as never)} />
      </SectionCard>

      <SectionCard title="Waiting Room" subtitle="Patients waiting for doctor visit will appear here.">
        {waiting.length ? (
          <View style={{ gap: 10 }}>
            {waiting.slice(0, 8).map((item) => (
              <AppointmentItem
                key={item.id}
                item={item}
                showPhoto={features.enable_patient_photos}
                showMedication={features.enable_prescription_medications}
                onPress={() => router.push(`/patient/${item.patient_id}` as never)}
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
  showPhoto,
  showMedication,
}: {
  item: AppointmentRow;
  onPress: () => void;
  showPhoto: boolean;
  showMedication: boolean;
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
