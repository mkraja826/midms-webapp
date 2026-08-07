import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { colors } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { askCapDentAiDentalChart } from "@/lib/capdent-ai";
import { normalizeRole } from "@/lib/supabase";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Props = {
  patientId: string;
  patientName: string;
};

const PROMPTS = [
  "Summarize this patient's recorded dental chart.",
  "Which tooth codes have recorded conditions?",
  "What treatments and treatment statuses are recorded on the dental chart?",
  "Summarize recorded dental-chart changes over time.",
];

function messageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function PatientDentalChartAi({ patientId, patientName }: Props) {
  const { profile } = useAuth();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "I can summarize this patient's recorded tooth-chart entries. I receive structured tooth codes, dentition, conditions, surfaces and recorded treatment status only; chart notes, identifiers, files and X-rays are excluded.",
    },
  ]);

  const normalizedRole = profile ? normalizeRole(profile.role) : "receptionist";
  const canUseClinicalAi = normalizedRole === "head_doctor" || normalizedRole === "working_doctor";
  const desktop = Platform.OS === "web" && width >= 760;
  const displayName = useMemo(() => patientName.trim() || "Patient", [patientName]);

  if (!canUseClinicalAi) return null;

  async function ask(question: string) {
    const cleaned = question.trim().slice(0, 300);
    if (!cleaned || loading) return;

    setInput("");
    setMessages((current) => [...current, { id: messageId(), role: "user", text: cleaned }]);
    setLoading(true);

    try {
      const result = await askCapDentAiDentalChart(patientId, cleaned);
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          text: result.answer || "No summary could be generated from the available dental-chart entries.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          text: error instanceof Error
            ? error.message
            : "CapDent AI could not load this patient's dental chart right now.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open AI dental chart summary for ${displayName}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: 76,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.primarySoft : colors.surface,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        })}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 17,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="grid-outline" size={23} color={colors.white} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>AI dental chart</Text>
          <Text numberOfLines={2} style={{ color: colors.muted, marginTop: 3, fontSize: 12, lineHeight: 17 }}>
            Summarize recorded tooth conditions, surfaces and treatment status · Read-only
          </Text>
        </View>
        <View
          style={{
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 5,
            backgroundColor: colors.primarySoft,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "900" }}>GROK</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(15, 23, 42, 0.36)",
              alignItems: desktop ? "flex-end" : "stretch",
              justifyContent: desktop ? "flex-start" : "flex-end",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close dental chart AI"
              onPress={() => setOpen(false)}
              style={{ position: "absolute", inset: 0 } as any}
            />

            <View
              style={{
                width: desktop ? Math.min(460, width * 0.44) : "100%",
                height: desktop ? height : Math.min(height * 0.92, 740),
                maxHeight: "100%",
                borderTopLeftRadius: desktop ? 28 : 30,
                borderTopRightRadius: desktop ? 0 : 30,
                backgroundColor: colors.background,
                overflow: "hidden",
                borderLeftWidth: desktop ? 1 : 0,
                borderTopWidth: desktop ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  backgroundColor: colors.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 15,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="grid-outline" size={21} color={colors.white} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                    {displayName} · Dental chart AI
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                    Structured chart entries only · Read-only
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setOpen(false)}
                  style={({ pressed }) => ({
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: pressed ? colors.surfaceSoft : colors.background,
                  })}
                >
                  <Ionicons name="close" size={23} color={colors.text} />
                </Pressable>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 14, gap: 10, flexGrow: 1 }}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 4 }}>
                  {PROMPTS.map((prompt) => (
                    <Pressable
                      key={prompt}
                      disabled={loading}
                      onPress={() => void ask(prompt)}
                      style={({ pressed }) => ({
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: pressed ? colors.primarySoft : colors.surface,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        opacity: loading ? 0.6 : 1,
                      })}
                    >
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>

                {messages.map((message) => {
                  const user = message.role === "user";
                  return (
                    <View
                      key={message.id}
                      style={{
                        alignSelf: user ? "flex-end" : "flex-start",
                        maxWidth: "90%",
                        borderRadius: 18,
                        borderBottomRightRadius: user ? 6 : 18,
                        borderBottomLeftRadius: user ? 18 : 6,
                        paddingHorizontal: 13,
                        paddingVertical: 11,
                        backgroundColor: user ? colors.primary : colors.surface,
                        borderWidth: user ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text selectable style={{ color: user ? colors.white : colors.text, lineHeight: 20, fontSize: 14 }}>
                        {message.text}
                      </Text>
                    </View>
                  );
                })}

                {loading ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      borderRadius: 18,
                      borderBottomLeftRadius: 6,
                      paddingHorizontal: 13,
                      paddingVertical: 11,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ color: colors.muted, fontSize: 13 }}>Summarizing recorded dental chart…</Text>
                  </View>
                ) : null}
              </ScrollView>

              <View
                style={{
                  padding: 12,
                  paddingBottom: Platform.OS === "ios" ? 20 : 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  backgroundColor: colors.surface,
                  gap: 7,
                }}
              >
                <View
                  style={{
                    minHeight: 50,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    flexDirection: "row",
                    alignItems: "flex-end",
                    paddingLeft: 13,
                    paddingRight: 5,
                    paddingVertical: 5,
                    gap: 8,
                  }}
                >
                  <TextInput
                    value={input}
                    onChangeText={setInput}
                    editable={!loading}
                    multiline
                    maxLength={300}
                    placeholder="Ask about recorded tooth-chart entries…"
                    placeholderTextColor={colors.muted}
                    onSubmitEditing={() => void ask(input)}
                    style={{
                      flex: 1,
                      minHeight: 38,
                      maxHeight: 100,
                      paddingVertical: 9,
                      color: colors.text,
                      fontSize: 14,
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send dental chart question"
                    disabled={loading || !input.trim()}
                    onPress={() => void ask(input)}
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: colors.primary,
                      opacity: loading || !input.trim() ? 0.45 : pressed ? 0.82 : 1,
                    })}
                  >
                    <Ionicons name="arrow-up" size={20} color={colors.white} />
                  </Pressable>
                </View>
                <Text style={{ color: colors.muted, fontSize: 10, textAlign: "center", lineHeight: 15 }}>
                  AI summarizes recorded chart data only. It does not diagnose or recommend treatment. Verify the source chart before clinical decisions.
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
