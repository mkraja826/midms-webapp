import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Text } from "react-native";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";

export default function UploadXrayRedirect() {
  const params = useLocalSearchParams<{ patient_id?: string }>();

  useEffect(() => {
    router.replace({
      pathname: "/patient/upload",
      params: {
        patient_id: typeof params.patient_id === "string" ? params.patient_id : "",
        file_type: "xray",
      },
    } as never);
  }, [params.patient_id]);

  return (
    <Screen>
      <Text style={{ color: colors.muted }}>Opening X-ray upload...</Text>
    </Screen>
  );
}
