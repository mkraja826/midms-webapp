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

function appointmentTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isWaitingStatus(status?: string | null) {
  const value = String(status || "").toLowerCase();
  return ["scheduled", "waiting", "checked_in", "booked"].includes(value);
}

export default function DoctorDashboard() {
  const { profile } = useAuth();
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

  const appointments = useMemo(() => stats?.todayAppointmentList ?? [], [stats?.todayAppointmentList]);
  const waiting = appointments.filter((item: AppointmentRow) => isWaitingStatus(item.status));
  const current = waiting[0];

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <ClinicBrandHeader subtitle={`${getRoleLabel(profile?.role ?? "working_doctor")} • Doctor Queue`} />

      {current ? (
        <SectionCard>
          <View
            style={{
              borderRadius: 24,
              backgroundColor: colors.primarySoft,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="person-outline" size={25} color={colors.white} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
                  Current Patient
                </Text>
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 22, marginTop: 2 }}>
                  {current.patients?.name || "Patient"}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>
                  {appointmentTime(current.appointment_time)}
                  {current.patients?.phone ? ` • ${current.patients.phone}` : ""}
                </Text>
              </View>

              <StatusBadge label="Waiting" tone="warning" />
            </View>

            <View style={{ gap: 10 }}>
              <AppButton
                title="Add Visit & Complete Queue"
                icon="create-outline"
                onPress={() =>
                  router.push({
                    pathname: "/patient/visit",
                    params: { patient_id: current.patient_id },
                  } as never)
                }
              />

              <AppButton
                title="Open Patient History"
                icon="folder-open-outline"
                variant="secondary"
                onPress={() => router.push(`/patient/${current.patient_id}` as never)}
              />
            </View>
          </View>
        </SectionCard>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="Waiting" value={loading ? "..." : summary?.waiting_count ?? waiting.length} icon="hourglass-outline" tone="warning" />
        <StatCard label="Completed" value={loading ? "..." : summary?.completed_count ?? 0} icon="checkmark-done-outline" tone="success" />
      </View>

      <SectionCard title="Doctor Actions" subtitle="Fast actions used during active patient treatment.">
        <ActionCard title="Search Patient" subtitle="Open previous history before treatment" icon="search-outline" onPress={() => router.push("/patient" as never)} />
        <ActionCard title="Ongoing Treatments" subtitle="Open planned, ongoing and outstanding work" icon="construct-outline" onPress={() => router.push("/treatments/ongoing" as never)} />
        <ActionCard title="Follow-up Reminders" subtitle="Today and overdue review patients" icon="notifications-outline" onPress={() => router.push("/reminders" as never)} />
        <ActionCard title="Add Visit Manually" subtitle="If patient is not in queue" icon="create-outline" onPress={() => router.push("/patient/visit" as never)} />
        <ActionCard title="Upload X-ray / Prescription" subtitle="Select patient, choose type, upload, done" icon="cloud-upload-outline" onPress={() => router.push("/patient/upload" as never)} />
        <ActionCard title="Gallery" subtitle="Quickly view all clinical files" icon="images-outline" onPress={() => router.push("/gallery" as never)} />
        <ActionCard title="Book Follow-up" subtitle="For review appointment" icon="calendar-number-outline" onPress={() => router.push("/appointment/book" as never)} />
        <ActionCard title="Legal & Account" subtitle="Logout, privacy, support and account options" icon="shield-checkmark-outline" onPress={() => router.push("/settings/legal" as never)} />
        <ActionCard title="Change Password" subtitle="Update your login password" icon="key-outline" onPress={() => router.push("/settings/change-password" as never)} />
      </SectionCard>

      <SectionCard title="Waiting Queue" subtitle="Tap a patient to start the visit entry.">
        {waiting.length ? (
          <View style={{ gap: 10 }}>
            {waiting.slice(0, 10).map((item: AppointmentRow) => (
              <Pressable
                key={item.id}
                onPress={() =>
                  router.push({
                    pathname: "/patient/visit",
                    params: { patient_id: item.patient_id },
                  } as never)
                }
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

                <StatusBadge label="Add Visit" tone="warning" />
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState title="No waiting patients" message="Reception check-ins will appear here." icon="checkmark-done-outline" />
        )}
      </SectionCard>
    </Screen>
  );
}
