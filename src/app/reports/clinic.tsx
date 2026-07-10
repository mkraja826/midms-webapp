import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatCard } from "@/components/StatCard";
import { colors } from "@/constants/colors";
import { DashboardStats, getDashboardStats, getWorkflowDashboardSummary } from "@/lib/supabase";

function money(value?: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ClinicReportScreen() {
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
      Alert.alert("Report load failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const todayAppointments = useMemo(() => stats?.todayAppointmentList ?? [], [stats?.todayAppointmentList]);

  const revenueRows = [
    { label: "OP Fees", value: summary?.op_fee_revenue_today, icon: "receipt-outline" as const },
    { label: "X-ray", value: summary?.xray_revenue_today, icon: "scan-outline" as const },
    { label: "Medication", value: summary?.medication_revenue_today, icon: "medical-outline" as const },
    { label: "Treatment", value: summary?.treatment_revenue_today, icon: "hammer-outline" as const },
    { label: "Pending Paid", value: summary?.pending_collected_today, icon: "checkmark-circle-outline" as const },
    { label: "Other", value: summary?.other_revenue_today, icon: "wallet-outline" as const },
  ];

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>Clinic Report</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Owner summary for {todayLabel()}. Use this before closing the clinic day.
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <StatCard label="Today Revenue" value={loading ? "..." : money(summary?.today_revenue ?? stats?.todayRevenue)} icon="cash-outline" tone="success" />
        <StatCard label="Pending Due" value={loading ? "..." : money(summary?.pending_payments ?? stats?.pendingPayments)} icon="wallet-outline" tone="warning" />
        <StatCard label="Patients Today" value={loading ? "..." : summary?.today_patient_count ?? 0} icon="people-outline" />
        <StatCard label="Completed" value={loading ? "..." : summary?.completed_count ?? 0} icon="checkmark-done-outline" tone="success" />
      </View>

      <SectionCard title="Revenue Breakdown" subtitle="Check each collection type before closing daily accounts.">
        <View style={{ gap: 10 }}>
          {revenueRows.map((row) => (
            <View
              key={row.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 18,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 15,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primarySoft,
                }}
              >
                <Ionicons name={row.icon} size={20} color={colors.primary} />
              </View>
              <Text style={{ flex: 1, color: colors.text, fontWeight: "900" }}>{row.label}</Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{loading ? "..." : money(row.value)}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Daily Workflow" subtitle="Quick health check for queue, visits, appointments, and patient load.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <StatCard label="Waiting" value={loading ? "..." : summary?.waiting_count ?? 0} icon="hourglass-outline" tone="warning" />
          <StatCard label="Appointments" value={loading ? "..." : todayAppointments.length} icon="calendar-number-outline" />
          <StatCard label="Total Patients" value={loading ? "..." : stats?.totalPatients ?? 0} icon="person-outline" />
          <StatCard label="Old Pending" value={loading ? "..." : money(summary?.pending_payments ?? stats?.pendingPayments)} icon="alert-circle-outline" tone="warning" />
        </View>
      </SectionCard>

      <SectionCard title="Owner Tools" subtitle="Review activity and export records without exposing technical IDs.">
        <View style={{ gap: 10 }}>
          <View style={{ padding: 14, borderRadius: 20, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
              Activity + Excel export
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              Activity log shows staff actions. Export downloads Excel-compatible owner data using patient names, staff names, dates and amounts.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <AppButton
              title="Activity Log"
              icon="pulse-outline"
              variant="secondary"
              onPress={() => router.push("/reports/activity" as never)}
              style={{ flex: 1 }}
            />
            <AppButton
              title="Excel Export"
              icon="download-outline"
              onPress={() => router.push("/reports/export" as never)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </SectionCard>

      <SectionCard title="Closing Checklist" subtitle="Use this every evening before leaving the clinic.">
        <View style={{ gap: 10 }}>
          {[
            "Reception OP fees checked",
            "Doctor queue completed",
            "Pending payments reviewed",
            "Prescriptions/X-rays uploaded",
            "Follow-up reminders checked",
            "Staff activity reviewed if needed",
          ].map((item) => (
            <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="checkmark-circle-outline" size={21} color={colors.success} />
              <Text style={{ flex: 1, color: colors.text, fontWeight: "800" }}>{item}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard
        title="Export Privacy"
        subtitle="Owner-facing exports should look human-readable and clinic-friendly."
      >
        <EmptyState
          title="No technical IDs in owner tools"
          message="Exports and activity views use patient names, phone numbers, patient codes, visit dates, staff names, and amounts. Internal database IDs, UUIDs, clinic IDs, file IDs, and user IDs stay hidden."
          icon="shield-checkmark-outline"
        />
      </SectionCard>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppButton title="Refresh" icon="refresh-outline" variant="secondary" onPress={load} loading={loading} style={{ flex: 1 }} />
        <AppButton title="Dashboard" icon="home-outline" variant="ghost" onPress={() => router.replace("/(head)/dashboard" as never)} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
