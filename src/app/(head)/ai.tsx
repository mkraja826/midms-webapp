import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import {
  askCapDentAiReadOnly,
  type CapDentAiAgentMessage,
} from "@/lib/capdent-ai-agent";
import { getRoleLabel } from "@/lib/supabase";

const QUICK_PROMPTS = [
  "How is my clinic doing today?",
  "Show today's collections and outstanding dues.",
  "Who is waiting right now?",
  "What appointments are scheduled tomorrow?",
  "Summarize treatments recorded this week.",
  "Show recent payment corrections, refunds, or voids.",
];

function cleanMessage(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 1600);
}

export default function CapDentAiScreen() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<CapDentAiAgentMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [lastTools, setLastTools] = useState<string[]>([]);

  const isWide = width >= 900;
  const normalizedRole = profile?.role === "owner" ? "head_doctor" : profile?.role;
  const hasAccess = normalizedRole === "head_doctor";
  const roleLabel = getRoleLabel(profile?.role ?? "head_doctor");

  const conversationHistory = useMemo(
    () => messages.slice(-10),
    [messages]
  );

  async function send(value = draft) {
    const question = cleanMessage(value);
    if (!question || sending || !hasAccess) return;

    const historyBeforeQuestion = conversationHistory;
    setMessages((current) => [...current, { role: "user", content: question }]);
    setDraft("");
    setError(null);
    setSending(true);
    setLastTools([]);

    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    try {
      const result = await askCapDentAiReadOnly(question, historyBeforeQuestion);
      setModel(result.model);
      setLastTools(result.used_tools ?? []);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CapDent AI could not answer that question.");
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  function clearConversation() {
    if (sending) return;
    setMessages([]);
    setDraft("");
    setError(null);
    setLastTools([]);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <View style={{ flex: 1, alignItems: "center" }}>
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: isWide ? 1100 : 760,
            paddingHorizontal: isWide ? 24 : 14,
            paddingTop: 14,
            paddingBottom: 12,
            gap: 12,
          }}
        >
          <View
            style={{
              minHeight: 62,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? colors.primarySoft : colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              })}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.text, fontSize: 21, fontWeight: "900" }}
                >
                  CapDent AI
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    borderRadius: 999,
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                    backgroundColor: colors.successSoft,
                  }}
                >
                  <Ionicons name="lock-closed-outline" size={13} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 10, fontWeight: "900" }}>
                    READ-ONLY
                  </Text>
                </View>
              </View>
              <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
                Groq clinic intelligence · {roleLabel}
              </Text>
            </View>

            {messages.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear AI conversation"
                onPress={clearConversation}
                style={({ pressed }) => ({
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? colors.dangerSoft : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                })}
              >
                <Ionicons name="trash-outline" size={19} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {!hasAccess ? (
            <View
              style={{
                backgroundColor: colors.warningSoft,
                borderRadius: 22,
                padding: 18,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
              }}
            >
              <Ionicons name="shield-outline" size={28} color={colors.warning} />
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>
                Owner access only
              </Text>
              <Text style={{ color: colors.muted, lineHeight: 20 }}>
                Full clinic read-only AI is currently available only to the clinic owner or head doctor.
              </Text>
            </View>
          ) : (
            <>
              <View
                style={{
                  flex: 1,
                  minHeight: 0,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 26,
                  overflow: "hidden",
                }}
              >
                <ScrollView
                  ref={scrollRef}
                  contentContainerStyle={{
                    flexGrow: 1,
                    padding: isWide ? 22 : 14,
                    gap: 12,
                  }}
                  keyboardShouldPersistTaps="handled"
                  onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                >
                  {!messages.length ? (
                    <WelcomePanel onPrompt={send} />
                  ) : (
                    messages.map((message, index) => (
                      <ChatBubble
                        key={`${message.role}-${index}`}
                        role={message.role}
                        content={message.content}
                        wide={isWide}
                      />
                    ))
                  )}

                  {sending ? (
                    <View
                      style={{
                        alignSelf: "flex-start",
                        maxWidth: isWide ? "72%" : "88%",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 9,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 18,
                        backgroundColor: colors.surfaceSoft,
                      }}
                    >
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={{ color: colors.muted, fontWeight: "700" }}>
                        Reading clinic records…
                      </Text>
                    </View>
                  ) : null}

                  {error ? (
                    <View
                      style={{
                        borderRadius: 16,
                        padding: 12,
                        backgroundColor: colors.dangerSoft,
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <Ionicons name="alert-circle-outline" size={19} color={colors.danger} />
                      <Text style={{ flex: 1, color: colors.danger, lineHeight: 19 }}>
                        {error}
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>

                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    padding: 12,
                    gap: 8,
                    backgroundColor: colors.surface,
                  }}
                >
                  {lastTools.length ? (
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10 }}>
                      Verified from CapDent: {lastTools.join(" · ")}
                    </Text>
                  ) : null}

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      gap: 9,
                    }}
                  >
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Ask about patients, payments, visits, appointments…"
                      placeholderTextColor={colors.muted}
                      multiline
                      maxLength={1600}
                      editable={!sending}
                      onSubmitEditing={() => {
                        if (Platform.OS === "web") void send();
                      }}
                      style={{
                        flex: 1,
                        minHeight: 48,
                        maxHeight: 130,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                        borderRadius: 18,
                        paddingHorizontal: 14,
                        paddingTop: 13,
                        paddingBottom: 11,
                        color: colors.text,
                        fontSize: 15,
                        lineHeight: 20,
                        outlineStyle: "none" as never,
                      }}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Send question to CapDent AI"
                      disabled={sending || !cleanMessage(draft)}
                      onPress={() => void send()}
                      style={({ pressed }) => ({
                        width: 48,
                        height: 48,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor:
                          sending || !cleanMessage(draft)
                            ? colors.border
                            : pressed
                              ? colors.primaryDark
                              : colors.primary,
                      })}
                    >
                      {sending ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Ionicons name="arrow-up" size={22} color={colors.white} />
                      )}
                    </Pressable>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 10, textAlign: "center" }}>
                    Read-only · Clinic-scoped · Cannot edit records, prescribe, or make new diagnoses
                    {model ? ` · ${model}` : ""}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function WelcomePanel({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingVertical: 24, gap: 18 }}>
      <View style={{ alignItems: "center", gap: 9 }}>
        <View
          style={{
            width: 62,
            height: 62,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primarySoft,
          }}
        >
          <Ionicons name="sparkles" size={30} color={colors.primary} />
        </View>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", textAlign: "center" }}>
          Ask about your clinic
        </Text>
        <Text
          style={{
            color: colors.muted,
            lineHeight: 20,
            textAlign: "center",
            maxWidth: 560,
          }}
        >
          CapDent AI can read your authorized clinic records and explain patients, appointments,
          treatments, payments, dues, gallery activity, staff, subscriptions, and audit history.
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, justifyContent: "center" }}>
        {QUICK_PROMPTS.map((prompt) => (
          <Pressable
            key={prompt}
            accessibilityRole="button"
            onPress={() => void onPrompt(prompt)}
            style={({ pressed }) => ({
              width: "48%",
              minWidth: 220,
              maxWidth: 360,
              minHeight: 66,
              borderRadius: 18,
              padding: 12,
              flexDirection: "row",
              gap: 9,
              alignItems: "center",
              backgroundColor: pressed ? colors.primarySoft : colors.background,
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "800", lineHeight: 18 }}>
              {prompt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ChatBubble({
  role,
  content,
  wide,
}: {
  role: "user" | "assistant";
  content: string;
  wide: boolean;
}) {
  const isUser = role === "user";
  return (
    <View
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: wide ? "76%" : "90%",
        borderRadius: 20,
        borderBottomRightRadius: isUser ? 6 : 20,
        borderBottomLeftRadius: isUser ? 20 : 6,
        paddingHorizontal: 14,
        paddingVertical: 11,
        backgroundColor: isUser ? colors.primary : colors.surfaceSoft,
      }}
    >
      {!isUser ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 }}>
          <Ionicons name="sparkles" size={13} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "900" }}>CAPDENT AI</Text>
        </View>
      ) : null}
      <Text
        selectable
        style={{
          color: isUser ? colors.white : colors.text,
          fontSize: 14,
          lineHeight: 21,
          fontWeight: isUser ? "700" : "500",
        }}
      >
        {content}
      </Text>
    </View>
  );
}
