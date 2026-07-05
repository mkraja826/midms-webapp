import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { colors } from "@/constants/colors";

export function SuccessNotice({ title, message }: { title: string; message?: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 18,
        padding: 12,
        backgroundColor: colors.successSoft,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>{title}</Text>
        {message ? <Text style={{ color: colors.muted, marginTop: 2 }}>{message}</Text> : null}
      </View>
    </View>
  );
}
