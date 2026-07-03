import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { EmptyState } from "@/components/EmptyState";
import { PatientCard } from "@/components/PatientCard";
import { QuickAction } from "@/components/QuickAction";
import { SectionCard } from "@/components/SectionCard";
import { StatCard } from "@/components/StatCard";
import { StatusChip } from "@/components/StatusChip";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { DashboardStats, getDashboardStats } from "@/lib/supabase";
import { appointmentReminderMessage, openWhatsApp } from "@/lib/whatsapp";

export default function DashboardScreen() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setStats(await getDashboardStats());
    } catch (error) {
      Alert.alert("Dashboard error", error instanceof Error ? error.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={colors.primary} /></View>;
  }

  const roleLabel = profile?.role === "owner" ? "Owner cockpit" : profile?.role === "doctor" ? "Doctor workspace" : "Reception desk";
  const nextAppointment = stats?.todayAppointmentList.find((item) => item.status === "scheduled");

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ backgroundColor: colors.primary, borderRadius: 18, padding: 18, gap: 12 }}>
        <StatusChip label={roleLabel} tone="primary" />
        <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "900" }}>Good day, {profile?.name ?? "Doctor"}</Text>
        <Text style={{ color: "#DCEBFF", fontSize: 15 }}>
          {nextAppointment ? `Next: ${nextAppointment.patients?.name ?? "Patient"} at ${new Date(nextAppointment.appointment_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No upcoming appointments left for today."}
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <StatCard label="Today's Appointments" value={stats?.todayAppointments ?? 0} />
        <StatCard label="Total Patients" value={stats?.totalPatients ?? 0} />
        <StatCard label="Pending Payments" value={`₹${stats?.pendingPayments ?? 0}`} />
        <StatCard label="Today's Revenue" value={`₹${stats?.todayRevenue ?? 0}`} />
      </View>

      <SectionCard title="Quick Actions">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <QuickAction icon="person-add-outline" label="Register patient" onPress={() => router.push("/patient/add")} />
          <QuickAction icon="calendar-outline" label="Book visit" onPress={() => router.push("/(tabs)/appointments")} />
          <QuickAction icon="cash-outline" label="Collect payment" onPress={() => router.push("/(tabs)/billing")} />
          <QuickAction icon="search-outline" label="Find patient" onPress={() => router.push("/(tabs)/patients")} />
        </View>
      </SectionCard>

      <SectionCard title="Today Appointment List">
        {stats?.todayAppointmentList.length ? stats.todayAppointmentList.map((item) => (
          <View key={item.id} style={{ gap: 8, borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>{item.patients?.name ?? "Patient"}</Text>
                <Text selectable style={{ color: colors.muted }}>
                  {new Date(item.appointment_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {item.profiles?.name ?? "Doctor not assigned"}
                </Text>
              </View>
              <StatusChip label={item.status} tone={item.status === "completed" ? "success" : item.status === "scheduled" ? "primary" : "warning"} />
            </View>
            <QuickAction
              icon="logo-whatsapp"
              label="Send reminder"
              onPress={() => openWhatsApp(item.patients?.phone, appointmentReminderMessage({ patientName: item.patients?.name ?? "Patient", appointmentTime: item.appointment_time }))}
            />
          </View>
        )) : <EmptyState title="No appointments today" body="Book the next patient visit from Quick Actions." icon="calendar-clear-outline" />}
      </SectionCard>

      <SectionCard title="Recent Patients">
        {stats?.recentPatients.length ? stats.recentPatients.map((patient) => (
          <Pressable key={patient.id} onPress={() => router.push({ pathname: "/patient/[id]", params: { id: patient.id } })}>
            <PatientCard patient={patient} />
          </Pressable>
        )) : <EmptyState title="No patients registered" body="Start by adding your first patient file." icon="people-outline" />}
      </SectionCard>
    </ScrollView>
  );
}