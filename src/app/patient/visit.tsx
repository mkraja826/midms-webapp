import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import { createAppointment, createInvoice, createVisit, getPatients, Patient, supabase } from "@/lib/supabase";

type ComplaintKey = "Pain" | "Swelling" | "Cap issue" | "Wisdom tooth" | "Broken tooth" | "Review" | "Other";

type Slot = {
  label: string;
  hour: number;
  minute: number;
};

type DateOption = {
  key: string;
  date: Date;
  monthDay: string;
  weekday: string;
  label: string;
};

const COMPLAINTS: { label: ComplaintKey; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { label: "Pain", icon: "flash-outline", hint: "Tooth pain / sensitivity" },
  { label: "Swelling", icon: "alert-circle-outline", hint: "Gum swelling / infection" },
  { label: "Cap issue", icon: "cube-outline", hint: "Crown or cap problem" },
  { label: "Wisdom tooth", icon: "triangle-outline", hint: "Wisdom tooth complaint" },
  { label: "Broken tooth", icon: "construct-outline", hint: "Broken / chipped tooth" },
  { label: "Review", icon: "refresh-circle-outline", hint: "Follow-up / routine review" },
  { label: "Other", icon: "ellipsis-horizontal-circle-outline", hint: "Anything else" },
];

const TIME_SLOTS: Slot[] = [
  { label: "11:00 AM", hour: 11, minute: 0 },
  { label: "11:30 AM", hour: 11, minute: 30 },
  { label: "12:00 PM", hour: 12, minute: 0 },
  { label: "12:30 PM", hour: 12, minute: 30 },
  { label: "01:00 PM", hour: 13, minute: 0 },
  { label: "01:30 PM", hour: 13, minute: 30 },
  { label: "05:00 PM", hour: 17, minute: 0 },
  { label: "05:30 PM", hour: 17, minute: 30 },
  { label: "06:00 PM", hour: 18, minute: 0 },
  { label: "06:30 PM", hour: 18, minute: 30 },
  { label: "07:00 PM", hour: 19, minute: 0 },
  { label: "07:30 PM", hour: 19, minute: 30 },
];

function toNumber(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function createDateOptions(days = 90): DateOption[] {
  const now = new Date();
  const options: DateOption[] = [];

  for (let index = 0; index < days; index++) {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    date.setHours(0, 0, 0, 0);

    options.push({
      key: getDateKey(date),
      date,
      monthDay: date.toLocaleDateString([], { month: "short", day: "numeric" }),
      weekday: date.toLocaleDateString([], { weekday: "short" }),
      label: index === 0 ? "Today" : index === 1 ? "Tomorrow" : date.toLocaleDateString([], { weekday: "short" }),
    });
  }

  return options;
}

function makeDateTime(date: Date, slot: Slot) {
  const value = new Date(date);
  value.setHours(slot.hour, slot.minute, 0, 0);
  return value;
}

function isFutureDateTime(date: Date, slot: Slot) {
  return makeDateTime(date, slot).getTime() > Date.now();
}

function formatSelectedDate(date: Date, slot: Slot) {
  return makeDateTime(date, slot).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AddVisitScreen() {
  const params = useLocalSearchParams<{ patient_id?: string }>();
  const incomingPatientId = typeof params.patient_id === "string" ? params.patient_id : "";

  const dateOptions = useMemo(() => createDateOptions(90), []);
  const firstDateWithFutureSlot = useMemo(() => {
    return dateOptions.find((option) => TIME_SLOTS.some((slot) => isFutureDateTime(option.date, slot))) || dateOptions[0];
  }, [dateOptions]);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(incomingPatientId);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedComplaints, setSelectedComplaints] = useState<ComplaintKey[]>([]);
  const [customComplaint, setCustomComplaint] = useState("");
  const [treatmentName, setTreatmentName] = useState("");
  const [treatmentCategory, setTreatmentCategory] = useState("");
  const [treatmentCost, setTreatmentCost] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [bookFollowup, setBookFollowup] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(firstDateWithFutureSlot.key);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadPatients() {
    try {
      setLoadingPatients(true);
      const rows = await getPatients();
      setPatients(rows);

      if (incomingPatientId && rows.some((patient) => patient.id === incomingPatientId)) {
        setSelectedPatientId(incomingPatientId);
      }
    } catch (error) {
      Alert.alert("Patients load failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoadingPatients(false);
    }
  }

  useEffect(() => {
    loadPatients();
  }, [incomingPatientId]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const filteredPatients = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    if (!term) return patients.slice(0, 12);

    return patients
      .filter((patient) => {
        return (
          patient.name.toLowerCase().includes(term) ||
          (patient.phone || "").toLowerCase().includes(term) ||
          (patient.patient_code || "").toLowerCase().includes(term)
        );
      })
      .slice(0, 12);
  }, [patientSearch, patients]);

  const selectedDate = dateOptions.find((option) => option.key === selectedDateKey) || firstDateWithFutureSlot;

  const availableTimeSlots = useMemo(() => {
    return TIME_SLOTS.map((slot, index) => ({
      ...slot,
      index,
      disabled: !isFutureDateTime(selectedDate.date, slot),
    }));
  }, [selectedDate]);

  useEffect(() => {
    const currentSlot = availableTimeSlots[selectedTimeIndex];

    if (!currentSlot || currentSlot.disabled) {
      const firstAvailable = availableTimeSlots.find((slot) => !slot.disabled);
      if (firstAvailable) setSelectedTimeIndex(firstAvailable.index);
    }
  }, [availableTimeSlots, selectedTimeIndex]);

  const selectedTime = TIME_SLOTS[selectedTimeIndex] || TIME_SLOTS[0];

  const complaintSummary = useMemo(() => {
    const selectedWithoutOther = selectedComplaints.filter((item) => item !== "Other");
    const parts: string[] = [];

    if (selectedWithoutOther.length) parts.push(selectedWithoutOther.join(", "));

    if (customComplaint.trim()) {
      parts.push(`Other: ${customComplaint.trim()}`);
    } else if (selectedComplaints.includes("Other")) {
      parts.push("Other complaint");
    }

    return parts.join(", ");
  }, [selectedComplaints, customComplaint]);

  function toggleComplaint(complaint: ComplaintKey) {
    setSelectedComplaints((current) => {
      if (current.includes(complaint)) return current.filter((item) => item !== complaint);
      return [...current, complaint];
    });
  }

  async function saveVisit() {
    if (!selectedPatientId) {
      Alert.alert("Patient missing", "Select the patient first.");
      return;
    }

    if (!complaintSummary.trim()) {
      Alert.alert("Complaint missing", "Select one complaint group or type in Other.");
      return;
    }

    const followupDateTime = bookFollowup ? makeDateTime(selectedDate.date, selectedTime) : null;

    if (followupDateTime && followupDateTime.getTime() <= Date.now()) {
      Alert.alert("Invalid appointment", "Follow-up must be within clinic hours and in the future.");
      return;
    }

    const cost = toNumber(treatmentCost);
    const paid = toNumber(paidAmount);

    if (paid > cost && cost > 0) {
      Alert.alert("Invalid payment", "Paid amount cannot be greater than treatment cost.");
      return;
    }

    setSaving(true);

    try {
      const visit = await createVisit({
        patient_id: selectedPatientId,
        chief_complaint: complaintSummary.trim(),
        diagnosis: undefined,
        doctor_notes: undefined,
        next_appointment_date: followupDateTime ? followupDateTime.toISOString() : null,
        treatment_name: treatmentName.trim() || undefined,
        treatment_cost: cost || undefined,
        treatment_category: treatmentCategory.trim() || undefined,
      });

      if (cost > 0) {
        await createInvoice({
          patient_id: selectedPatientId,
          visit_id: visit.id,
          total_amount: cost,
          paid_amount: paid,
        });
      }

      if (followupDateTime) {
        await createAppointment({
          patient_id: selectedPatientId,
          appointment_time: followupDateTime.toISOString(),
          notes: `Follow-up for: ${complaintSummary}`,
        });
      }

      await supabase.rpc("mark_patient_visit_completed", {
        p_patient_id: selectedPatientId,
      });

      Alert.alert(
        "Visit saved",
        "Visit saved and patient removed from waiting queue. Reception can collect medication fee if needed.",
        [{ text: "Open Patient", onPress: () => router.replace(`/patient/${selectedPatientId}` as never) }]
      );
    } catch (error) {
      Alert.alert("Save visit failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen refreshing={loadingPatients} onRefresh={loadPatients}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>Add Visit</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Select complaint, add treatment/payment if needed, and complete the patient from waiting queue.
        </Text>
      </View>

      <SectionCard title="Patient" subtitle="Confirm the correct patient before adding today's visit.">
        {selectedPatient ? (
          <View style={{ padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="person-circle-outline" size={26} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>{selectedPatient.name}</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>
                  {selectedPatient.phone || "No phone"}
                  {selectedPatient.age ? ` • ${selectedPatient.age} yrs` : ""}
                </Text>
              </View>
              <StatusBadge label="Selected" tone="success" />
            </View>

            <AppButton
              title="Edit Medical History"
              icon="medkit-outline"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: "/patient/medical-history", params: { patient_id: selectedPatient.id } } as never)
              }
            />

            {!incomingPatientId ? (
              <AppButton title="Change Patient" icon="swap-horizontal-outline" variant="secondary" onPress={() => setSelectedPatientId("")} />
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View
              style={{
                minHeight: 54,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.background,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 14,
                gap: 10,
              }}
            >
              <Ionicons name="search-outline" size={21} color={colors.muted} />
              <TextInput
                value={patientSearch}
                onChangeText={setPatientSearch}
                placeholder="Search patient name, phone, or ID"
                placeholderTextColor={colors.muted}
                style={{ flex: 1, minHeight: 54, color: colors.text, fontSize: 16 }}
              />
            </View>

            {loadingPatients ? (
              <Text style={{ color: colors.muted }}>Loading patients...</Text>
            ) : filteredPatients.length ? (
              <View style={{ gap: 10 }}>
                {filteredPatients.map((patient) => (
                  <Pressable
                    key={patient.id}
                    onPress={() => setSelectedPatientId(patient.id)}
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
                    <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="person-outline" size={21} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "900" }}>{patient.name}</Text>
                      <Text style={{ color: colors.muted, marginTop: 2 }}>{patient.phone || "No phone"}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <EmptyState title="No patients found" message="Reception should check-in/register patient first." icon="search-outline" />
            )}
          </View>
        )}
      </SectionCard>

      <SectionCard title="Chief Complaint" subtitle="Simple grouping only. Diagnosis/prescription stays in upload section.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {COMPLAINTS.map((item) => {
            const selected = selectedComplaints.includes(item.label);

            return (
              <Pressable
                key={item.label}
                onPress={() => toggleComplaint(item.label)}
                style={{
                  width: "47%",
                  minHeight: 106,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : colors.background,
                  padding: 13,
                  justifyContent: "space-between",
                }}
              >
                <Ionicons name={item.icon} size={22} color={selected ? colors.white : colors.primary} />
                <View style={{ gap: 4 }}>
                  <Text style={{ color: selected ? colors.white : colors.text, fontWeight: "900", fontSize: 15 }}>{item.label}</Text>
                  <Text numberOfLines={2} style={{ color: selected ? colors.white : colors.muted, fontSize: 11, lineHeight: 15 }}>{item.hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {selectedComplaints.includes("Other") || customComplaint.trim() ? (
          <AppInput label="Other complaint details" value={customComplaint} onChangeText={setCustomComplaint} placeholder="Short detail only if needed" multiline />
        ) : null}

        {complaintSummary ? (
          <View style={{ padding: 12, borderRadius: 16, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>Summary</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>{complaintSummary}</Text>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Treatment & Billing" subtitle="Optional. Add treatment cost and paid amount only when needed.">
        <AppInput label="Treatment name" value={treatmentName} onChangeText={setTreatmentName} placeholder="RCT, extraction, filling, scaling..." />
        <AppInput label="Treatment category" value={treatmentCategory} onChangeText={setTreatmentCategory} placeholder="Optional category" />
        <AppInput label="Treatment cost" value={treatmentCost} onChangeText={setTreatmentCost} keyboardType="numeric" placeholder="Example: 2500" />
        <AppInput label="Paid now" value={paidAmount} onChangeText={setPaidAmount} keyboardType="numeric" placeholder="Example: 1000" helper="If paid partially, due amount is created automatically." />
      </SectionCard>

      <SectionCard title="Follow-up Appointment" subtitle="Optional. Allowed timings: 11:00 AM-1:30 PM and 5:00 PM-7:30 PM only.">
        <Pressable
          onPress={() => setBookFollowup((current) => !current)}
          style={{
            minHeight: 56,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: bookFollowup ? colors.primary : colors.border,
            backgroundColor: bookFollowup ? colors.primarySoft : colors.background,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            gap: 12,
          }}
        >
          <Ionicons name={bookFollowup ? "checkbox-outline" : "square-outline"} size={23} color={bookFollowup ? colors.primary : colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>Book follow-up</Text>
            <Text style={{ color: colors.muted, marginTop: 2 }}>
              {bookFollowup ? formatSelectedDate(selectedDate.date, selectedTime) : "No follow-up appointment"}
            </Text>
          </View>
        </Pressable>

        {bookFollowup ? (
          <View style={{ gap: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
              {dateOptions.map((option) => {
                const selected = selectedDateKey === option.key;
                const hasFutureSlot = TIME_SLOTS.some((slot) => isFutureDateTime(option.date, slot));

                return (
                  <Pressable
                    key={option.key}
                    disabled={!hasFutureSlot}
                    onPress={() => setSelectedDateKey(option.key)}
                    style={{
                      width: 86,
                      minHeight: 88,
                      borderRadius: 22,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : colors.background,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      opacity: hasFutureSlot ? 1 : 0.35,
                    }}
                  >
                    <Text style={{ color: selected ? colors.white : colors.muted, fontSize: 12, fontWeight: "900" }}>{option.label}</Text>
                    <Text style={{ color: selected ? colors.white : colors.text, fontSize: 19, fontWeight: "900" }}>{option.monthDay}</Text>
                    <Text style={{ color: selected ? colors.white : colors.muted, fontSize: 11 }}>{option.weekday}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
              {availableTimeSlots.map((slot) => {
                const selected = selectedTimeIndex === slot.index;

                return (
                  <Pressable
                    key={slot.label}
                    disabled={slot.disabled}
                    onPress={() => setSelectedTimeIndex(slot.index)}
                    style={{
                      minWidth: 92,
                      minHeight: 48,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : colors.background,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      opacity: slot.disabled ? 0.32 : 1,
                    }}
                  >
                    <Text style={{ color: selected ? colors.white : colors.text, fontWeight: "900" }}>{slot.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </SectionCard>

      <AppButton title="Save Visit & Complete Queue" icon="save-outline" onPress={saveVisit} loading={saving} loadingTitle="Saving visit..." />
      <AppButton title="Back" icon="arrow-back-outline" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
