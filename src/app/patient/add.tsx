import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Switch, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { AppInput } from "@/components/AppInput";
import { SectionCard } from "@/components/SectionCard";
import { colors } from "@/constants/colors";
import { createPatient } from "@/lib/supabase";

export default function AddPatientScreen() {
  const [form, setForm] = useState({
    name: "",
    gender: "",
    age: "",
    phone: "",
    email: "",
    address: "",
    emergency_contact: "",
    allergies: "",
    current_medicines: "",
    other_notes: "",
  });
  const [historyFlags, setHistoryFlags] = useState({
    heart_issue: false,
    kidney_issue: false,
    brain_issue: false,
    diabetes: false,
    blood_pressure: false,
  });
  const [saving, setSaving] = useState(false);

  function setField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) {
      Alert.alert("Required fields", "Full name and phone are required.");
      return;
    }
    setSaving(true);
    try {
      const patient = await createPatient({
        name: form.name.trim(),
        gender: form.gender.trim(),
        age: form.age.trim() ? Number(form.age) : undefined,
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim(),
        emergency_contact: form.emergency_contact.trim(),
        medical_history: {
          ...historyFlags,
          allergies: form.allergies.trim(),
          current_medicines: form.current_medicines.trim(),
          other_notes: form.other_notes.trim(),
        },
      });
      router.replace({ pathname: "/patient/[id]", params: { id: patient.id } });
    } catch (error) {
      Alert.alert("Patient save failed", error instanceof Error ? error.message : "Unable to add patient.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <SectionCard title="Patient Details">
        <AppInput label="Full name" value={form.name} onChangeText={(value) => setField("name", value)} />
        <AppInput label="Gender" value={form.gender} onChangeText={(value) => setField("gender", value)} />
        <AppInput label="Age" value={form.age} onChangeText={(value) => setField("age", value)} keyboardType="numeric" placeholder="Years" />
        <AppInput label="Phone" value={form.phone} onChangeText={(value) => setField("phone", value)} keyboardType="phone-pad" />
        <AppInput label="Email optional" value={form.email} onChangeText={(value) => setField("email", value)} keyboardType="email-address" autoCapitalize="none" />
        <AppInput label="Address" value={form.address} onChangeText={(value) => setField("address", value)} multiline />
        <AppInput label="Emergency contact" value={form.emergency_contact} onChangeText={(value) => setField("emergency_contact", value)} />
      </SectionCard>
      <SectionCard title="Medical History">
        {[
          ["heart_issue", "Heart issue"],
          ["kidney_issue", "Kidney issue"],
          ["brain_issue", "Brain issue"],
          ["diabetes", "Diabetes / sugar"],
          ["blood_pressure", "Blood pressure / BP"],
        ].map(([key, label]) => (
          <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
            <Switch
              value={historyFlags[key as keyof typeof historyFlags]}
              onValueChange={(value) => setHistoryFlags((current) => ({ ...current, [key]: value }))}
              trackColor={{ true: colors.primarySoft, false: colors.border }}
              thumbColor={historyFlags[key as keyof typeof historyFlags] ? colors.primary : "#FFFFFF"}
            />
          </View>
        ))}
        <AppInput label="Allergies" value={form.allergies} onChangeText={(value) => setField("allergies", value)} />
        <AppInput label="Current medicines" value={form.current_medicines} onChangeText={(value) => setField("current_medicines", value)} />
        <AppInput label="Other notes" value={form.other_notes} onChangeText={(value) => setField("other_notes", value)} multiline />
      </SectionCard>
      <AppButton title="Register Patient" onPress={save} loading={saving} />
    </ScrollView>
  );
}
