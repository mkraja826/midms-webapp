import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, View } from "react-native";
import { colors } from "@/constants/colors";

type Props = {
  busy?: boolean;
  onReschedule: () => void;
  onCompleted: () => void;
};

export function WaitingAppointmentActions({ busy = false, onReschedule, onCompleted }: Props) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose a new appointment date and time"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={onReschedule}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.surfaceSoft : colors.primarySoft,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: busy ? 0.58 : 1,
        })}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="calendar-number-outline" size={22} color={colors.primary} />
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mark appointment completed"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={onCompleted}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? colors.surfaceSoft : colors.successSoft,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: busy ? 0.58 : 1,
        })}
      >
        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
      </Pressable>
    </View>
  );
}
