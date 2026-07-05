import { Text, TextInput, TextInputProps, View } from "react-native";
import { colors } from "@/constants/colors";

type Props = TextInputProps & {
  label: string;
  helper?: string;
};

export function AppInput({ label, helper, style, ...props }: Props) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "900" }}>
        {label}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={[
          {
            minHeight: props.multiline ? 96 : 54,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: 15,
            paddingTop: props.multiline ? 12 : undefined,
            color: colors.text,
            fontSize: 16,
          },
          style,
        ]}
      />
      {helper ? (
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
