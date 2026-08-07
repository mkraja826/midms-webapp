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
import { askCapDentAiToday } from "@/lib/capdent-ai";
import { normalizeRole } from "@/lib/supabase";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const BASE_PROMPTS = [
  "How is my clinic doing today?",
  "How many patients are waiting?",
  "How many visits were completed today?",
];

const FINANCE_PROMPTS = ["What are today's collections?", "How much is still due?"];

function messageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CapDentAiLauncher() {
  const { profile } = useAuth();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask me about today's clinic activity. I only use the clinic data your role is allowed to see.",
    },
  ]);

  const normalizedRole = profile ? normalizeRole(profile.role) : "receptionist";
  const canViewFinance = normalizedRole === "head_doctor" || normalizedRole === "receptionist";
  const prompts = useMemo(
    () => (canViewFinance ? [...BASE_PROMPTS, ...FINANCE_PROMPTS] : BASE_PROMPTS),
    [canViewFinance]
  );
  const desktop = Platform.OS === "web" && width >= 760;

  async function ask(question: string) {
    const cleaned = question.trim().slice(0, 300);
    if (!cleaned || loading) return;

    setInput("");
    setMessages((current) => [
      ...current,
      { id: messageId(), role: "user", text: cleaned },
    ]);
    setLoading(true);

    try {
      const result = await askCapDentAiToday(cleaned);
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          text: result.answer || "I couldn't prepare an answer from today's available clinic metrics.",
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
            : "CapDent AI is temporarily unavailable. Please try again.",
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
        accessibilityLabel="Open CapDent AI"
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: 70,
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
          <Ionicons name="sparkles" size={23} color={colors.white} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
            CapDent AI
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3, fontSize: 12 }}>
            Ask about today's clinic activity · Read-only
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
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "900" }}>GROK</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
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
              accessibilityLabel="Close CapDent AI"
              onPress={() => setOpen(false)}
              style={{ position: "absolute", inset: 0 } as any}
            />

            <View
              style={{
                width: desktop ? Math.min(440, width * 0.42) : "100%",
                height: desktop ? height : Math.min(height * 0.9, 720),
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
                  <Ionicons name="sparkles" size={21} color={colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                    CapDent AI
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                    Powered by Grok · Aggregate clinic data · Read-only
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
                  {prompts.map((prompt) => (
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
                      <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>
                        {prompt}
                      </Text>
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
                        maxWidth: "88%",
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
                      <Text
                        selectable
                        style={{
                          color: user ? colors.white : colors.text,
                          lineHeight: 20,
                          fontSize: 14,
                        }}
                      >
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
                    <Text style={{ color: colors.muted, fontSize: 13 }}>Reviewing today's metrics…</Text>
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
                    placeholder="Ask about today's clinic activity…"
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
                    accessibilityLabel="Send question"
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
                <Text style={{ color: colors.muted, fontSize: 10, textAlign: "center" }}>
                  Current scope: today's aggregate clinic metrics. AI cannot modify records.
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
