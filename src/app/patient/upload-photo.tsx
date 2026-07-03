import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Text } from "react-native";
import { Screen } from "@/components/Screen";
import { colors } from "@/constants/colors";

export default function UploadPhotoRedirectScreen() {
  const params = useLocalSearchParams<{
    patient_id?: string;
    file_type?: string;
  }>();

  useEffect(() => {
    const fileType =
      params.file_type === "after_photo" ? "after_photo" : "before_photo";

    router.replace({
      pathname: "/patient/upload",
      params: {
        patient_id: typeof params.patient_id === "string" ? params.patient_id : "",
        file_type: fileType,
      },
    } as never);
  }, [params.patient_id, params.file_type]);

  return (
    <Screen>
      <Text style={{ color: colors.muted }}>Opening photo upload...</Text>
    </Screen>
  );
}
