import { Text, View } from "react-native";
import { colors } from "@/constants/colors";

export function TimelineItem({ title, subtitle, meta }: { title: string; subtitle?: string; meta?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ alignItems: "center" }}>
        <View style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: colors.primary, marginTop: 5 }} />
        <View style={{ flex: 1, width: 1, backgroundColor: colors.border, minHeight: 44 }} />
      </View>
      <View style={{ flex: 1, gap: 4, paddingBottom: 14 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{title}</Text>
        {subtitle ? <Text selectable style={{ color: colors.muted }}>{subtitle}</Text> : null}
        {meta ? <Text selectable style={{ color: colors.muted, fontSize: 12 }}>{meta}</Text> : null}
      </View>
    </View>
  );
}
