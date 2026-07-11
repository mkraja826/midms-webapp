import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import {
  getOngoingTreatments,
  updateOngoingTreatmentStatus,
} from "@/lib/ongoingTreatments";
import type { OngoingTreatmentItem, OngoingTreatmentStatus } from "@/lib/ongoingTreatments";

function money(value?: number) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function statusLabel(status: OngoingTreatmentStatus) {
  if (status === "ongoing") return "Ongoing";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Planned";
}

function statusTone(status: OngoingTreatmentStatus) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  if (status === "ongoing") return "warning" as const;
  return "primary" as const;
}

function dateLabel(value?: string | null) {
  if (!value) return "No visit date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No visit date";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export function OngoingTreatmentsSection({
  allowStatusUpdates,
  doctorOnly,
  limit = 6,
}: {
  allowStatusUpdates?: boolean;
  doctorOnly?: boolean;
  limit?: number;
}) {
  const [items, setItems] = useState<OngoingTreatmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const rows = await getOngoingTreatments({ limit, doctorOnly });
      setItems(rows);
    } catch (error) {
      console.warn("Ongoing treatments load failed:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [doctorOnly, limit]);

  async function updateStatus(item: OngoingTreatmentItem, status: OngoingTreatmentStatus) {
    try {
      setUpdatingId(item.id);
      await updateOngoingTreatmentStatus(item.id, status);
      await load();
      Alert.alert("Treatment updated", `${item.treatmentName} is now ${statusLabel(status).toLowerCase()}.`);
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <SectionCard
      title="Ongoing Treatments"
      subtitle="Planned and ongoing treatments with outstanding payment and next-sitting actions."
    >
      {loading ? (
        <View style={{ padding: 14, borderRadius: 18, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.muted, fontWeight: "800" }}>Loading ongoing treatments...</Text>
        </View>
      ) : items.length ? (
        <View style={{ gap: 10 }}>
          {items.map((item) => (
            <TreatmentCard
              key={item.id}
              item={item}
              allowStatusUpdates={allowStatusUpdates}
              updating={updatingId === item.id}
              onUpdateStatus={(status) => updateStatus(item, status)}
            />
          ))}
          <AppButton
            title="Open Treatment Review"
            icon="medkit-outline"
            variant="secondary"
            onPress={() => router.push("/reports/treatments" as never)}
          />
        </View>
      ) : (
        <EmptyState
          title="No outstanding treatments"
          message="When a visit has a planned treatment, it will appear here until it is marked completed or cancelled."
          icon="checkmark-done-outline"
        />
      )}
    </SectionCard>
  );
}

function TreatmentCard({
  item,
  allowStatusUpdates,
  updating,
  onUpdateStatus,
}: {
  item: OngoingTreatmentItem;
  allowStatusUpdates?: boolean;
  updating?: boolean;
  onUpdateStatus: (status: OngoingTreatmentStatus) => void;
}) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        gap: 12,
      }}
    >
      <Pressable
        onPress={() => router.push(`/patient/${item.patientId}` as never)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 17,
            backgroundColor: item.status === "ongoing" ? colors.warningSoft : colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="hammer-outline" size={22} color={item.status === "ongoing" ? colors.warning : colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            {item.treatmentName}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>
            {item.patientName}
            {item.patientCode ? ` • ${item.patientCode}` : ""}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
            {dateLabel(item.visitDate || item.createdAt)}
            {item.doctorName ? ` • Dr. ${item.doctorName}` : ""}
          </Text>
        </View>

        <StatusBadge label={statusLabel(item.status)} tone={statusTone(item.status)} />
      </Pressable>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>Treatment</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 }}>{money(item.cost)}</Text>
        </View>
        <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: item.paymentCleared ? colors.successSoft : colors.warningSoft, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>
            {item.paymentCleared ? "Payment" : "Outstanding"}
          </Text>
          <Text style={{ color: item.paymentCleared ? colors.success : colors.warning, fontSize: 18, fontWeight: "900", marginTop: 4 }}>
            {item.paymentCleared ? "Paid" : money(item.dueAmount)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <AppButton
          title="Patient"
          icon="person-circle-outline"
          variant="secondary"
          onPress={() => router.push(`/patient/${item.patientId}` as never)}
          style={{ flex: 1, minWidth: "30%" }}
        />
        <AppButton
          title="Plan Sitting"
          icon="calendar-number-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: "/appointment/book", params: { patient_id: item.patientId } } as never)}
          style={{ flex: 1, minWidth: "30%" }}
        />
        {!item.paymentCleared ? (
          <AppButton
            title="Collect"
            icon="cash-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: "/payment/fee", params: { fee_type: "treatment_fee" } } as never)}
            style={{ flex: 1, minWidth: "30%" }}
          />
        ) : null}
      </View>

      {allowStatusUpdates ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {item.status === "planned" ? (
            <AppButton
              title="Start"
              icon="play-outline"
              variant="secondary"
              loading={updating}
              onPress={() => onUpdateStatus("ongoing")}
              style={{ flex: 1 }}
            />
          ) : null}
          <AppButton
            title="Complete"
            icon="checkmark-done-outline"
            loading={updating}
            onPress={() => onUpdateStatus("completed")}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
    </View>
  );
}
