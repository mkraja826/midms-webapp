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
import { createAppointment, createInvoice, createVisit, getCurrentProfile, getPatients, supabase } from "@/lib/supabase";
import type { Patient, Profile } from "@/lib/supabase";

type ComplaintKey = "Pain" | "Swelling" | "Cap issue" | "Wisdom tooth" | "Broken tooth" | "Review" | "Other";
type TreatmentFlow = "undecided" | "ongoing" | "new";

type DoctorOption = Pick<Profile, "id" | "name" | "role">;

type ActiveTreatment = {
  id: string;
  treatment_name: string | null;
  category: string | null;
  cost: number | string | null;
  status: "planned" | "ongoing" | "completed" | "cancelled";
  created_at: string;
};

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

function toNumber(value: string | number | null | undefined) {
  const cleaned = String(value ?? "").replace(/[^0-9.]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value: string | number | null | undefined) {
  return `₹${Math.max(0, Math.round(Number(value || 0))).toLocaleString("en-IN")}`;
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

function doctorRoleLabel(role?: string | null) {
  if (role === "owner" || role === "head_doctor") return "Head Doctor";
  if (role === "working_doctor" || role === "doctor") return "Doctor";
  return role || "Doctor";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message || "Please try again.");
  return "Please try again.";
}

export default function AddVisitScreen() {
  const params = useLocalSearchParams<{ patient_id?: string }>();
  const incomingPatientId = typeof params.patient_id === "string" ? params.patient_id : "";

  const dateOptions = useMemo(() => createDateOptions(90), []);
  const firstDateWithFutureSlot = useMemo(() => {
    return dateOptions.find((option) => TIME_SLOTS.some((slot) => isFutureDateTime(option.date, slot))) || dateOptions[0];
  }, [dateOptions]);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(incomingPatientId);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedComplaints, setSelectedComplaints] = useState<ComplaintKey[]>([]);
  const [customComplaint, setCustomComplaint] = useState("");
  const [treatmentName, setTreatmentName] = useState("");
  const [treatmentCategory, setTreatmentCategory] = useState("");
  const [treatmentCost, setTreatmentCost] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [pendingBalance, setPendingBalance] = useState(0);
  const [activeTreatments, setActiveTreatments] = useState<ActiveTreatment[]>([]);
  const [activeTreatmentDue, setActiveTreatmentDue] = useState(0);
  const [treatmentFlow, setTreatmentFlow] = useState<TreatmentFlow>("undecided");
  const [promptedTreatmentKey, setPromptedTreatmentKey] = useState("");
  const [loadingPendingBalance, setLoadingPendingBalance] = useState(false);
  const [loadingActiveTreatments, setLoadingActiveTreatments] = useState(false);
  const [bookFollowup, setBookFollowup] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(firstDateWithFutureSlot.key);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
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
      Alert.alert("Patients load failed", getErrorMessage(error));
    } finally {
      setLoadingPatients(false);
    }
  }

  async function loadDoctors() {
    try {
      setLoadingDoctors(true);
      const profile = await getCurrentProfile();

      if (!profile?.clinic_id) {
        setDoctors([]);
        setSelectedDoctorId("");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,role")
        .eq("clinic_id", profile.clinic_id)
        .eq("active", true)
        .in("role", ["owner", "head_doctor", "working_doctor", "doctor"])
        .order("name", { ascending: true });

      if (error) throw error;

      const rows = (data || []) as DoctorOption[];
      setDoctors(rows);
      setSelectedDoctorId((current) => {
        if (current && rows.some((doctor) => doctor.id === current)) return current;
        const currentUserDoctor = rows.find((doctor) => doctor.id === profile.id);
        return currentUserDoctor?.id || rows[0]?.id || "";
      });
    } catch (error) {
      console.warn("Doctors load failed", error instanceof Error ? error.message : error);
      Alert.alert("Doctors load failed", "Doctor list could not be loaded. Try again.");
      setDoctors([]);
      setSelectedDoctorId("");
    } finally {
      setLoadingDoctors(false);
    }
  }

  async function loadScreenData() {
    await Promise.all([loadPatients(), loadDoctors()]);
  }

  useEffect(() => {
    loadScreenData();
  }, [incomingPatientId]);

  useEffect(() => {
    setTreatmentFlow("undecided");
    setPromptedTreatmentKey("");
  }, [selectedPatientId]);

  useEffect(() => {
    let active = true;

    async function loadPatientMoneyAndTreatments() {
      if (!selectedPatientId) {
        setPendingBalance(0);
        setActiveTreatments([]);
        setActiveTreatmentDue(0);
        setLoadingPendingBalance(false);
        setLoadingActiveTreatments(false);
        return;
      }

      try {
        setLoadingPendingBalance(true);
        setLoadingActiveTreatments(true);

        const [invoiceResult, treatmentResult] = await Promise.all([
          supabase
            .from("invoices")
            .select("due_amount,payment_category,status")
            .eq("patient_id", selectedPatientId)
            .gt("due_amount", 0)
            .in("status", ["unpaid", "partial"]),
          supabase
            .from("treatments")
            .select("id,treatment_name,category,cost,status,created_at")
            .eq("patient_id", selectedPatientId)
            .in("status", ["planned", "ongoing"])
            .order("created_at", { ascending: false }),
        ]);

        if (invoiceResult.error) throw invoiceResult.error;
        if (treatmentResult.error) throw treatmentResult.error;

        const invoices = invoiceResult.data ?? [];
        const totalDue = invoices.reduce(
          (sum: number, row: { due_amount?: number | string | null }) => sum + Number(row.due_amount || 0),
          0
        );
        const treatmentDue = invoices
          .filter((row: { payment_category?: string | null }) => row.payment_category === "treatment_fee")
          .reduce((sum: number, row: { due_amount?: number | string | null }) => sum + Number(row.due_amount || 0), 0);

        if (active) {
          setPendingBalance(totalDue);
          setActiveTreatmentDue(treatmentDue);
          setActiveTreatments((treatmentResult.data || []) as ActiveTreatment[]);
        }
      } catch (error) {
        console.warn("Patient balance/treatment guard load failed", error instanceof Error ? error.message : error);
        if (active) {
          setPendingBalance(0);
          setActiveTreatmentDue(0);
          setActiveTreatments([]);
        }
      } finally {
        if (active) {
          setLoadingPendingBalance(false);
          setLoadingActiveTreatments(false);
        }
      }
    }

    loadPatientMoneyAndTreatments();

    return () => {
      active = false;
    };
  }, [selectedPatientId]);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === selectedDoctorId) || null,
    [doctors, selectedDoctorId]
  );

  const filteredPatients = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    const rows = !term
      ? patients.slice(0, 12)
      : patients
          .filter((patient) => {
            return (
              patient.name.toLowerCase().includes(term) ||
              (patient.phone || "").toLowerCase().includes(term) ||
              (patient.patient_code || "").toLowerCase().includes(term)
            );
          })
          .slice(0, 12);

    return rows;
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
  const treatmentCostValue = toNumber(treatmentCost);
  const paidNowValue = toNumber(paidAmount);
  const balanceAfterVisit = Math.max(pendingBalance + treatmentCostValue - paidNowValue, 0);
  const hasActiveTreatment = activeTreatments.length > 0;
  const primaryActiveTreatment = activeTreatments[0] || null;
  const activeTreatmentKey = `${selectedPatientId}:${activeTreatments.map((item) => item.id).join(",")}`;
  const hasNewTreatmentEntry = Boolean(treatmentName.trim() || treatmentCategory.trim() || treatmentCostValue > 0 || paidNowValue > 0);

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

  function clearTreatmentFields() {
    setTreatmentName("");
    setTreatmentCategory("");
    setTreatmentCost("");
    setPaidAmount("");
  }

  function chooseOngoingTreatment() {
    setTreatmentFlow("ongoing");
    clearTreatmentFields();
  }

  function chooseNewTreatment() {
    setTreatmentFlow("new");
  }

  function showTreatmentFlowPopup(saveAfterChoice = false) {
    const first = primaryActiveTreatment;
    const details = [
      `${first?.treatment_name || "Existing treatment"} • ${first?.status || "ongoing"}`,
      first?.cost ? `Cost: ${formatMoney(first.cost)}` : null,
      activeTreatmentDue > 0 ? `Treatment pending: ${formatMoney(activeTreatmentDue)}` : "Treatment payment cleared or no due found",
    ]
      .filter(Boolean)
      .join("\n");

    Alert.alert(
      "Ongoing treatment found",
      `This patient already has active treatment. Choose how today's visit should be saved.\n\n${details}`,
      [
        {
          text: "Ongoing Treatment",
          onPress: () => {
            chooseOngoingTreatment();
            if (saveAfterChoice) void saveVisit({ flow: "ongoing" });
          },
        },
        {
          text: "New Treatment",
          style: "destructive",
          onPress: () => {
            chooseNewTreatment();
            if (saveAfterChoice) void saveVisit({ flow: "new", confirmedSeparateTreatment: true });
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  useEffect(() => {
    if (!selectedPatientId || loadingActiveTreatments || !hasActiveTreatment) return;
    if (promptedTreatmentKey === activeTreatmentKey) return;

    setPromptedTreatmentKey(activeTreatmentKey);
    showTreatmentFlowPopup(false);
  }, [selectedPatientId, loadingActiveTreatments, hasActiveTreatment, activeTreatmentKey, promptedTreatmentKey]);

  async function saveVisit(options?: { confirmedSeparateTreatment?: boolean; flow?: TreatmentFlow }) {
    if (saving) return;

    if (!selectedPatientId) {
      Alert.alert("Patient missing", "Select the patient first.");
      return;
    }

    if (!selectedDoctorId) {
      Alert.alert("Doctor missing", "Select which doctor treated the patient.");
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
    const selectedFlow = hasActiveTreatment ? options?.flow ?? treatmentFlow : "new";
    const continuingExistingTreatment = hasActiveTreatment && selectedFlow === "ongoing";
    const creatingSeparateTreatment = hasActiveTreatment && selectedFlow === "new";
    const shouldCreateTreatment = !continuingExistingTreatment && Boolean(treatmentName.trim() || cost > 0);

    if (hasActiveTreatment && selectedFlow === "undecided") {
      showTreatmentFlowPopup(true);
      return;
    }

    if (continuingExistingTreatment && paid > 0) {
      Alert.alert(
        "Use Reception Fees",
        "For an existing ongoing treatment payment, collect pending amount from Reception Fees so it is applied to the old pending invoice."
      );
      return;
    }

    if (creatingSeparateTreatment && !shouldCreateTreatment) {
      Alert.alert("New treatment details missing", "Enter treatment name and cost, or choose Ongoing Treatment to save this visit under the existing treatment.");
      return;
    }

    if (!continuingExistingTreatment && paid > 0 && cost <= 0) {
      Alert.alert("Treatment amount missing", "Enter treatment cost before entering Paid now, or collect old pending from Reception Fees.");
      return;
    }

    if (!continuingExistingTreatment && cost > 0 && !treatmentName.trim()) {
      Alert.alert("Treatment name missing", "Enter treatment name before adding treatment cost.");
      return;
    }

    if (!continuingExistingTreatment && paid > cost && cost > 0) {
      Alert.alert("Invalid payment", "Paid amount cannot be greater than treatment cost.");
      return;
    }

    setSaving(true);

    try {
      const visit = await createVisit({
        patient_id: selectedPatientId,
        chief_complaint: complaintSummary.trim(),
        diagnosis: undefined,
        doctor_notes: continuingExistingTreatment
          ? `Ongoing treatment visit: ${primaryActiveTreatment?.treatment_name || "existing treatment"}. ${followupDateTime ? "Follow-up planned; treatment remains ongoing." : "No follow-up planned; treatment marked completed."}`
          : undefined,
        next_appointment_date: followupDateTime ? followupDateTime.toISOString() : null,
        treatment_name: shouldCreateTreatment ? treatmentName.trim() : undefined,
        treatment_cost: shouldCreateTreatment ? cost : undefined,
        treatment_category: shouldCreateTreatment ? treatmentCategory.trim() || undefined : undefined,
      });

      const { error: doctorUpdateError } = await supabase
        .from("patient_visits")
        .update({ doctor_id: selectedDoctorId })
        .eq("id", visit.id);

      if (doctorUpdateError) throw doctorUpdateError;

      if (continuingExistingTreatment && primaryActiveTreatment?.id) {
        const { error: treatmentStatusError } = await supabase
          .from("treatments")
          .update({ status: followupDateTime ? "ongoing" : "completed" })
          .eq("id", primaryActiveTreatment.id)
          .eq("patient_id", selectedPatientId);

        if (treatmentStatusError) throw treatmentStatusError;
      }

      if (shouldCreateTreatment && cost > 0) {
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
          doctor_id: selectedDoctorId,
          appointment_time: followupDateTime.toISOString(),
          notes: continuingExistingTreatment
            ? `Ongoing treatment follow-up: ${primaryActiveTreatment?.treatment_name || complaintSummary}${selectedDoctor ? ` • Treated by ${selectedDoctor.name}` : ""}`
            : `Follow-up for: ${complaintSummary}${selectedDoctor ? ` • Treated by ${selectedDoctor.name}` : ""}`,
        });
      }

      await supabase.rpc("mark_patient_visit_completed", {
        p_patient_id: selectedPatientId,
      });

      Alert.alert(
        continuingExistingTreatment ? "Ongoing visit saved" : "Visit saved",
        continuingExistingTreatment
          ? followupDateTime
            ? "Visit saved under the existing treatment. Follow-up added, so treatment remains ongoing."
            : "Visit saved under the existing treatment. No follow-up added, so treatment is marked completed."
          : `Visit saved under ${selectedDoctor?.name || "selected doctor"} and patient removed from waiting queue.`,
        [{ text: "Open Patient", onPress: () => router.replace(`/patient/${selectedPatientId}` as never) }]
      );
    } catch (error) {
      Alert.alert("Save visit failed", getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen refreshing={loadingPatients || loadingDoctors} onRefresh={loadScreenData}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>Add Visit</Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Select patient, select treated doctor, add complaint/treatment, and complete the waiting queue.
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
                  {selectedPatient.patient_code || "No ID"} • {selectedPatient.phone || "No phone"}
                  {selectedPatient.age ? ` • ${selectedPatient.age} yrs` : ""}
                </Text>
              </View>
              <StatusBadge label="Selected" tone="success" />
            </View>

            <AppButton
              title="Edit Medical History"
              icon="medkit-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: "/patient/medical-history", params: { patient_id: selectedPatient.id } } as never)}
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
                      <Text style={{ color: colors.muted, marginTop: 2 }}>
                        {patient.patient_code || "No ID"} • {patient.phone || "No phone"}
                        {patient.age ? ` • ${patient.age} yrs` : ""}
                      </Text>
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

      {selectedPatient && (loadingActiveTreatments || hasActiveTreatment) ? (
        <SectionCard title="Ongoing treatment check" subtitle="Choose whether today is the old treatment or a separate new treatment.">
          {loadingActiveTreatments ? (
            <Text style={{ color: colors.muted }}>Checking active treatments...</Text>
          ) : hasActiveTreatment ? (
            <View style={{ gap: 12 }}>
              <View style={{ padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningSoft, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="warning-outline" size={24} color={colors.warning} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>This patient already has active treatment</Text>
                    <Text style={{ color: colors.muted, marginTop: 3, lineHeight: 18 }}>
                      Select Ongoing Treatment for the same procedure. Select New Treatment only when doctor confirms a different procedure.
                    </Text>
                  </View>
                  <StatusBadge label={`${activeTreatments.length} active`} tone="warning" />
                </View>

                {activeTreatments.slice(0, 2).map((item) => (
                  <View key={item.id} style={{ padding: 12, borderRadius: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.text, fontWeight: "900" }}>{item.treatment_name || "Treatment"}</Text>
                    <Text style={{ color: colors.muted, marginTop: 3 }}>
                      {item.status.toUpperCase()} • {formatMoney(item.cost)}{item.category ? ` • ${item.category}` : ""}
                    </Text>
                  </View>
                ))}

                <Text style={{ color: colors.text, fontWeight: "900" }}>Treatment pending: {formatMoney(activeTreatmentDue)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
                  Ongoing + no follow-up = marks existing treatment completed. Ongoing + follow-up = keeps it ongoing.
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <AppButton
                  title="Ongoing Treatment"
                  icon="repeat-outline"
                  variant={treatmentFlow === "ongoing" ? "primary" : "secondary"}
                  onPress={chooseOngoingTreatment}
                  style={{ flex: 1 }}
                />
                <AppButton
                  title="New Treatment"
                  icon="add-circle-outline"
                  variant={treatmentFlow === "new" ? "primary" : "secondary"}
                  onPress={chooseNewTreatment}
                  style={{ flex: 1 }}
                />
              </View>
              <AppButton title="Open Ongoing Treatments" icon="construct-outline" variant="ghost" onPress={() => router.push("/treatments/ongoing" as never)} />
            </View>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard title="Treated By" subtitle="Reception can select the doctor when entering visit from oral instructions.">
        {loadingDoctors ? (
          <Text style={{ color: colors.muted }}>Loading doctors...</Text>
        ) : doctors.length ? (
          <View style={{ gap: 10 }}>
            {doctors.map((doctor) => {
              const selected = selectedDoctorId === doctor.id;

              return (
                <Pressable
                  key={doctor.id}
                  onPress={() => setSelectedDoctorId(doctor.id)}
                  style={{
                    minHeight: 62,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primarySoft : colors.background,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 15,
                      backgroundColor: selected ? colors.primary : colors.surfaceSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={selected ? "checkmark-outline" : "medical-outline"} size={21} color={selected ? colors.white : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{doctor.name || "Doctor"}</Text>
                    <Text style={{ color: colors.muted, marginTop: 2 }}>{doctorRoleLabel(doctor.role)}</Text>
                  </View>
                  {selected ? <StatusBadge label="Treating" tone="success" /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            title="No doctor found"
            message="Add an owner/head doctor or working doctor in Staff before saving visits from reception."
            icon="medical-outline"
          />
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

      <SectionCard
        title="Treatment & Billing"
        subtitle={
          hasActiveTreatment && treatmentFlow === "ongoing"
            ? "Ongoing selected: no new treatment or invoice will be created from these fields."
            : hasActiveTreatment
              ? "New treatment is allowed only when doctor confirms a separate procedure."
              : "Optional. Add treatment cost and paid amount only when needed."
        }
      >
        {hasActiveTreatment && treatmentFlow === "ongoing" ? (
          <View style={{ padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.success, backgroundColor: colors.successSoft, gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>Saving under existing treatment</Text>
            <Text style={{ color: colors.muted, lineHeight: 18 }}>
              No duplicate treatment or invoice will be created. Use Reception Fees to collect old pending treatment amount.
            </Text>
          </View>
        ) : (
          <>
            <AppInput label="Treatment name" value={treatmentName} onChangeText={setTreatmentName} placeholder="RCT, extraction, filling, scaling..." />
            <AppInput label="Treatment category" value={treatmentCategory} onChangeText={setTreatmentCategory} placeholder="Optional category" />
            <AppInput label="Treatment cost" value={treatmentCost} onChangeText={setTreatmentCost} keyboardType="numeric" placeholder="Example: 2500" />
          </>
        )}

        <View
          style={{
            padding: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: pendingBalance > 0 ? colors.warning : colors.border,
            backgroundColor: pendingBalance > 0 ? colors.warningSoft : colors.surfaceSoft,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="wallet-outline" size={18} color={pendingBalance > 0 ? colors.warning : colors.primary} />
            <Text style={{ color: colors.text, fontWeight: "900" }}>
              Previous pending: {loadingPendingBalance ? "Checking..." : formatMoney(pendingBalance)}
            </Text>
          </View>
          {(pendingBalance > 0 || treatmentCostValue > 0 || paidNowValue > 0) ? (
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
              Balance after this visit: {formatMoney(balanceAfterVisit)}
            </Text>
          ) : null}
        </View>

        {!(hasActiveTreatment && treatmentFlow === "ongoing") ? (
          <AppInput label="Paid now" value={paidAmount} onChangeText={setPaidAmount} keyboardType="numeric" placeholder="Example: 1000" helper="If paid partially, due amount is created automatically. For old pending collection, use Reception Fees." />
        ) : null}
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

      <AppButton
        title={hasActiveTreatment && treatmentFlow === "ongoing" ? "Save Ongoing Visit" : hasActiveTreatment && treatmentFlow === "new" ? "Save New Treatment Visit" : "Save Visit & Complete Queue"}
        icon="save-outline"
        onPress={() => saveVisit()}
        loading={saving}
        loadingTitle="Saving visit..."
      />
      <AppButton title="Back" icon="arrow-back-outline" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
