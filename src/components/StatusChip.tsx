import { Text, View } from "react-native";
import { colors } from "@/constants/colors";

type Tone = "neutral" | "success" | "warning" | "danger" | "primary";

const toneColors: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: "#F1F5F9", fg: colors.muted },
  success: { bg: "#E8F7EF", fg: colors.success },
  warning: { bg: "#FFF4DE", fg: colors.warning },
  danger: { bg: "#FDECEC", fg: colors.danger },
  primary: { bg: colors.primarySoft, fg: colors.primary },
};

export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  const color = toneColors[tone];
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: color.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ color: color.fg, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}
