import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";

export type RouteTarget = string | { pathname: string; params?: Record<string, string> };

export type WorkflowBottomNavItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: RouteTarget;
  replace?: boolean;
};

export function WorkflowBottomNav({
  items,
  activeKey,
}: {
  items: WorkflowBottomNavItem[];
  activeKey: string;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingHorizontal: isWide ? 24 : 10,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: isWide ? 820 : undefined,
          alignSelf: "center",
          flexDirection: "row",
          gap: 4,
        }}
      >
        {items.map((item) => {
          const active = item.key === activeKey;

          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (active) return;
                if (item.replace) {
                  router.replace(item.href as never);
                  return;
                }
                router.push(item.href as never);
              }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 56,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                backgroundColor: active
                  ? colors.primarySoft
                  : pressed
                    ? colors.surfaceSoft
                    : "transparent",
                opacity: pressed && !active ? 0.88 : 1,
              })}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={active ? colors.primary : colors.muted}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.76}
                style={{
                  color: active ? colors.primaryDark : colors.muted,
                  fontSize: 11,
                  fontWeight: "900",
                  textAlign: "center",
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
