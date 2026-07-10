import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import {
  PatientDirectoryDateField,
  PatientDirectoryDatePreset,
  searchPatientsPage,
} from "@/lib/patientDirectory";
import { Patient } from "@/lib/supabase";

type DatePreset = PatientDirectoryDatePreset;
type DateField = PatientDirectoryDateField;

const PAGE_SIZE = 10;

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

function phoneDialUrl(phone?: string | null) {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  return digits ? `tel:${digits}` : "";
}

export default function PatientSearchScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateField, setDateField] = useState<DateField>("registered");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [scrollKey, setScrollKey] = useState(0);

  async function runSearch(next?: {
    query?: string;
    datePreset?: DatePreset;
    dateField?: DateField;
    page?: number;
  }) {
    const finalQuery = next?.query ?? query;
    const finalPreset = next?.datePreset ?? datePreset;
    const finalField = next?.dateField ?? dateField;
    const finalPage = next?.page ?? page;

    if (finalPreset === "custom" && (!startDate.trim() || !endDate.trim())) {
      Alert.alert("Date range required", "Enter start and end date in YYYY-MM-DD format.");
      return;
    }

    try {
      setSearching(true);
      const result = await searchPatientsPage({
        query: finalQuery,
        dateField: finalField,
        preset: finalPreset,
        startDate,
        endDate,
        page: finalPage,
        pageSize: PAGE_SIZE,
      });

      setPatients(result.patients);
      setTotalCount(result.total);
      setPage(result.page);
      setScrollKey((value) => value + 1);
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
    runSearch({ datePreset: "all", page: 1 });
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = totalCount ? (currentPage - 1) * PAGE_SIZE : 0;
  const rangeStart = totalCount ? pageStart + 1 : 0;
  const rangeEnd = Math.min(pageStart + patients.length, totalCount);
  const hasFilters = Boolean(query.trim()) || datePreset !== "all";

  const title = useMemo(() => {
    if (loading) return "Loading latest patients...";
    if (!totalCount) return hasFilters ? "No results" : "No patients yet";
    if (hasFilters) {
      return `Showing ${rangeStart}-${rangeEnd} of ${totalCount} result${totalCount === 1 ? "" : "s"}`;
    }
    return `Latest patients: ${rangeStart}-${rangeEnd} of ${totalCount}`;
  }, [hasFilters, loading, rangeEnd, rangeStart, totalCount]);

  function updatePreset(next: DatePreset) {
    setDatePreset(next);
    setPage(1);
    if (next !== "custom") runSearch({ datePreset: next, page: 1 });
  }

  function updateField(next: DateField) {
    setDateField(next);
    setPage(1);
    runSearch({ dateField: next, page: 1 });
  }

  function searchFirstPage() {
    setPage(1);
    runSearch({ page: 1 });
  }

  function goToPage(nextPage: number) {
    const safePage = Math.max(1, Math.min(totalPages, nextPage));
    setPage(safePage);
    runSearch({ page: safePage });
  }

  function clearFilters() {
    setQuery("");
    setDatePreset("all");
    setDateField("registered");
    setStartDate("");
    setEndDate("");
    setPage(1);
    runSearch({ query: "", datePreset: "all", dateField: "registered", page: 1 });
  }

  async function callPatient(phone?: string | null) {
    const url = phoneDialUrl(phone);

    if (!url) {
      Alert.alert("No phone number", "This patient does not have a phone number.");
      return;
    }

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Call unavailable", "This device or browser cannot open phone calls.");
    }
  }

  return (
    <Screen refreshing={loading || searching} onRefresh={() => runSearch({ page })} scrollToTopKey={scrollKey}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Patients
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Latest 10 patients appear first. Search checks the full clinic database, not only the current page.
        </Text>
      </View>

      <SectionCard title="Find Patient" subtitle="Search existing patients first. Add patient only when no record exists.">
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
            onSubmitEditing={searchFirstPage}
            placeholder="Search patient name, phone, or patient code"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            returnKeyType="search"
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
                setPage(1);
                runSearch({ query: "", page: 1 });
              }}
            >
              <Ionicons name="close-circle" size={22} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <AppButton title="Search" icon="search-outline" onPress={searchFirstPage} loading={searching} style={{ flex: 1 }} />
          <AppButton title="Clear" icon="close-circle-outline" variant="secondary" onPress={clearFilters} style={{ flex: 1 }} />
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
          <AppButton
            title="Add New Patient"
            icon="person-add-outline"
            variant="secondary"
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

      <SectionCard title={title} subtitle="Page loads 10 patients at a time for faster clinic use.">
        {loading || searching ? (
          <Text style={{ color: colors.muted }}>
            {loading ? "Loading latest patients..." : "Searching full database..."}
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
                      Patient Code: {patient.patient_code}
                    </Text>
                  ) : null}
                </View>

                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <StatusBadge label={patient.gender || "Patient"} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${patient.name}`}
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        callPatient(patient.phone);
                      }}
                      style={({ pressed }) => ({
                        width: 38,
                        height: 38,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: pressed ? colors.success : colors.successSoft,
                        borderWidth: 1,
                        borderColor: colors.border,
                      })}
                    >
                      <Ionicons name="call-outline" size={19} color={colors.success} />
                    </Pressable>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </View>
                </View>
              </Pressable>
            ))}

            <View style={{ gap: 10, marginTop: 4 }}>
              <Text style={{ color: colors.muted, textAlign: "center", fontWeight: "800" }}>
                Page {currentPage} of {totalPages} • {rangeStart}-{rangeEnd} / {totalCount}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <AppButton
                  title="Previous"
                  icon="chevron-back-outline"
                  variant="secondary"
                  disabled={currentPage <= 1 || searching}
                  onPress={() => goToPage(currentPage - 1)}
                  style={{ flex: 1 }}
                />
                <AppButton
                  title="Next"
                  icon="chevron-forward-outline"
                  disabled={currentPage >= totalPages || searching}
                  onPress={() => goToPage(currentPage + 1)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        ) : (
          <EmptyState
            title={hasFilters ? "No matching patient" : "No patients yet"}
            message={
              hasFilters
                ? "No patient matched this search. Add patient only after checking spelling or phone number."
                : "Register the first patient to start building clinic history."
            }
            icon={hasFilters ? "search-outline" : "person-add-outline"}
          />
        )}
      </SectionCard>
    </Screen>
  );
}
