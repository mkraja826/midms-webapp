import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type ClinicBrand = {
  id: string;
  name: string;
  logo_url?: string | null;
};

export function ClinicBrandHeader({
  subtitle,
  showManage = false,
}: {
  subtitle?: string;
  showManage?: boolean;
}) {
  const { profile } = useAuth();
  const [brand, setBrand] = useState<ClinicBrand | null>(null);

  async function load() {
    try {
      if (!profile?.clinic_id) return;

      const { data, error } = await supabase
        .from("clinics")
        .select("id,name,logo_url")
        .eq("id", profile.clinic_id)
        .maybeSingle();

      if (error) throw error;

      setBrand(data as ClinicBrand | null);
    } catch (error) {
      console.warn("Clinic brand load failed:", error);
    }
  }

  useEffect(() => {
    load();
  }, [profile?.clinic_id]);

  const canManage = profile?.role === "head_doctor" || profile?.role === "owner";

  return (
    <View
      style={{
        borderRadius: 26,
        padding: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 20,
            backgroundColor: colors.primarySoft,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {brand?.logo_url ? (
            <Image
              source={{ uri: brand.logo_url }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="medkit-outline" size={28} color={colors.primary} />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}
          >
            {brand?.name || "Dental Clinic"}
          </Text>

          <Text
            numberOfLines={2}
            style={{ color: colors.muted, fontSize: 14, marginTop: 3, lineHeight: 19 }}
          >
            {subtitle || "Clinic workspace"}
          </Text>
        </View>

        {showManage && canManage ? (
          <Pressable
            onPress={() => router.push("/clinic/branding" as never)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="brush-outline" size={20} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
