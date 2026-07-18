import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { type ComponentProps, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { WorkflowBottomNav, type WorkflowBottomNavItem } from "@/components/WorkflowBottomNav";
import { colors } from "@/constants/colors";

type IconName = ComponentProps<typeof Ionicons>["name"];
type ToolTarget = string | { pathname: string; params?: Record<string, string> };

type Tool = {
  title: string;
  subtitle: string;
  icon: IconName;
  target: ToolTarget;
};

type Section = {
  title: string;
  tools: Tool[];
};

export function MoreToolsScreen({
  title,
  subtitle,
  sections,
  navItems,
}: {
  title: string;
  subtitle: string;
  sections: Section[];
  navItems: WorkflowBottomNavItem[];
}) {
  return (
    <Screen bottomBar={<WorkflowBottomNav items={navItems} activeKey="more" />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 16,
            backgroundColor: pressed ? colors.primarySoft : colors.surfaceSoft,
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          <Ionicons name="arrow-back-outline" size={22} color={colors.primary} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}>{title}</Text>
          <Text style={{ color: colors.muted, marginTop: 2, lineHeight: 20 }}>{subtitle}</Text>
        </View>
      </View>

      {sections.map((section) => (
        <ToolSection key={section.title} title={section.title}>
          {section.tools.map((tool, index) => (
            <ToolRow
              key={tool.title}
              {...tool}
              isLast={index === section.tools.length - 1}
            />
          ))}
        </ToolSection>
      ))}
    </Screen>
  );
}

function ToolSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>{title}</Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: colors.surface,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function ToolRow({
  title,
  subtitle,
  icon,
  target,
  isLast,
}: Tool & { isLast: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={() => router.push(target as never)}
      style={({ pressed }) => ({
        minHeight: 66,
        paddingVertical: 11,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.surfaceSoft : colors.surface,
      })}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 15,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={21} color={colors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>
          {title}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}
