import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { PatientCard } from "@/components/PatientCard";
import { colors } from "@/constants/colors";
import { Patient, searchPatients } from "@/lib/supabase";

export default function PatientsScreen() {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (value = query) => {
    try {
      setPatients(await searchPatients(value));
    } catch (error) {
      Alert.alert("Patients error", error instanceof Error ? error.message : "Unable to load patients.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const timer = setTimeout(() => load(query), 300);
    return () => clearTimeout(timer);
  }, [query, load]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 14 }}>
      <AppInput label="Search patients" value={query} onChangeText={setQuery} placeholder="Name or phone" />

      <AppButton title="Add Patient" onPress={() => router.push("/patient/add")} />

      {loading ? <ActivityIndicator color={colors.primary} /> : null}

      {!loading && !patients.length ? (
        <Text style={{ color: colors.muted, textAlign: "center", padding: 24 }}>No patients found.</Text>
      ) : null}

      <View style={{ gap: 12 }}>
        {patients.map((patient) => (
          <Pressable key={patient.id} onPress={() => router.push({ pathname: "/patient/[id]", params: { id: patient.id } })}>
            <PatientCard patient={patient} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}