import { Text, View } from "react-native";
import { colors } from "@/constants/colors";
import { Patient } from "@/lib/supabase";

export function PatientCard({ patient }: { patient: Patient }) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 15,
        gap: 6,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>{patient.name}</Text>
      <Text selectable style={{ color: colors.muted }}>{patient.phone || "No phone"} · {patient.gender || "Gender not set"}</Text>
      <Text selectable style={{ color: colors.muted, fontSize: 13 }}>{patient.patient_code || "No patient code"}</Text>
    </View>
  );
}
