import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import { Patient, searchPatientsAdvanced } from "@/lib/supabase";

type DatePreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";
type DateField = "registered" | "visit" | "appointment" | "followup" | "payment";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

const DATE_FIELDS: { key: DateField; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "registered", label: "Registered", icon: "person-add-outline" },
  { key: "visit", label: "Visit", icon: "medical-outline" },
  { key: "appointment", label: "Appointment", icon: "calendar-outline" },
  { key: "followup", label: "Follow-up", icon: "notifications-outline" },
  { key: "payment", label: "Payment", icon: "cash-outline" },
];

export default function PatientSearchScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateField, setDateField] = useState<DateField>("registered");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  async function runSearch(next?: {
    query?: string;
    datePreset?: DatePreset;
    dateField?: DateField;
  }) {
    const finalQuery = next?.query ?? query;
    const finalPreset = next?.datePreset ?? datePreset;
    const finalField = next?.dateField ?? dateField;

    if (finalPreset === "custom" && (!startDate.trim() || !endDate.trim())) {
      Alert.alert("Date range required", "Enter start and end date in YYYY-MM-DD format.");
      return;
    }

    try {
      setSearching(true);
      const rows = await searchPatientsAdvanced({
        query: finalQuery,
        dateField: finalField,
        preset: finalPreset,
        startDate,
        endDate,
      });
      setPatients(rows);
    } catch (error) {
      Alert.alert(
        "Search failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

  useEffect(() => {
    runSearch({ datePreset: "all" });
  }, []);

  const title = useMemo(() => {
    if (loading) return "Loading patients...";
    if (query.trim() || datePreset !== "all") return `${patients.length} result${patients.length === 1 ? "" : "s"}`;
    return `${patients.length} patient${patients.length === 1 ? "" : "s"}`;
  }, [datePreset, loading, patients.length, query]);

  function updatePreset(next: DatePreset) {
    setDatePreset(next);
    if (next !== "custom") runSearch({ datePreset: next });
  }

  function updateField(next: DateField) {
    setDateField(next);
    runSearch({ dateField: next });
  }

  function clearFilters() {
    setQuery("");
    setDatePreset("all");
    setDateField("registered");
    setStartDate("");
    setEndDate("");
    runSearch({ query: "", datePreset: "all", dateField: "registered" });
  }

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Patients
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Search patients by name, phone, ID, registration, visit, appointment, follow-up, or payment date.
        </Text>
      </View>

      <SectionCard>
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
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch()}
            placeholder="Search patient name, phone, or ID"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 16,
              minHeight: 54,
            }}
          />

          {query ? (
            <Pressable
              onPress={() => {
                setQuery("");
                runSearch({ query: "" });
              }}
            >
              <Ionicons name="close-circle" size={22} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DATE_PRESETS.map((item) => {
            const selected = datePreset === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => updatePreset(item.key)}
                style={{
                  minHeight: 40,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : colors.background,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: selected ? colors.white : colors.text, fontWeight: "900", fontSize: 12 }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DATE_FIELDS.map((item) => {
            const selected = dateField === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => updateField(item.key)}
                style={{
                  minHeight: 42,
                  borderRadius: 999,
                  paddingHorizontal: 11,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primarySoft : colors.background,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Ionicons name={item.icon} size={15} color={colors.primary} />
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {datePreset === "custom" ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <AppInput
              label="Start"
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              style={{ minHeight: 48 }}
            />
            <AppInput
              label="End"
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              style={{ minHeight: 48 }}
            />
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <AppButton title="Search" icon="search-outline" onPress={() => runSearch()} style={{ flex: 1 }} />
          <AppButton title="Clear" icon="close-circle-outline" variant="secondary" onPress={clearFilters} style={{ flex: 1 }} />
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <AppButton
            title="Add Patient"
            icon="person-add-outline"
            onPress={() => router.push("/patient/add" as never)}
            style={{ flex: 1 }}
          />
          <AppButton
            title="Old Patient"
            icon="archive-outline"
            variant="secondary"
            onPress={() => router.push("/patient/add-old" as never)}
            style={{ flex: 1 }}
          />
        </View>
      </SectionCard>

      <SectionCard title={title}>
        {loading || searching ? (
          <Text style={{ color: colors.muted }}>
            {loading ? "Loading patients..." : "Searching..."}
          </Text>
        ) : patients.length ? (
          <View style={{ gap: 10 }}>
            {patients.map((patient) => (
              <Pressable
                key={patient.id}
                onPress={() => router.push(`/patient/${patient.id}` as never)}
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
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="person-outline" size={22} color={colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                    {patient.name}
                  </Text>

                  <Text style={{ color: colors.muted, marginTop: 3 }}>
                    {patient.phone || "No phone"}{patient.age ? ` • ${patient.age} yrs` : ""}
                  </Text>

                  {patient.patient_code ? (
                    <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
                      ID: {patient.patient_code}
                    </Text>
                  ) : null}
                </View>

                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <StatusBadge label={patient.gender || "Patient"} />
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState
            title={query.trim() || datePreset !== "all" ? "No matching patient" : "No patients yet"}
            message={
              query.trim() || datePreset !== "all"
                ? "Try another search or date filter."
                : "Register the first patient to start building clinic history."
            }
            icon={query.trim() || datePreset !== "all" ? "search-outline" : "person-add-outline"}
          />
        )}
      </SectionCard>
    </Screen>
  );
}
