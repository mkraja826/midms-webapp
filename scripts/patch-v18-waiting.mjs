import fs from "node:fs";
import path from "node:path";

const files = {
  reception: path.join(process.cwd(), "src", "app", "(reception)", "dashboard.tsx"),
  head: path.join(process.cwd(), "src", "app", "(head)", "dashboard.tsx"),
};

for (const [label, filePath] of Object.entries(files)) {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${label} dashboard: ${filePath}`);
    process.exit(1);
  }
}

function replaceOnce(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) {
    console.error(`Could not apply ${label}. The dashboard source has changed.`);
    process.exit(1);
  }
  return source.replace(search, replacement);
}

function patchReception() {
  let source = fs.readFileSync(files.reception, "utf8");

  source = replaceOnce(
    source,
    'import { useEffect, useMemo, useState, type ComponentProps } from "react";\nimport { Alert, Pressable, Text, View } from "react-native";',
    'import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";\nimport { Alert, Platform, Pressable, Text, View } from "react-native";',
    "reception React imports"
  );

  source = replaceOnce(
    source,
    '  getWorkflowDashboardSummary,\n} from "@/lib/supabase";',
    '  getWorkflowDashboardSummary,\n  supabase,\n  updateAppointmentStatus,\n} from "@/lib/supabase";',
    "reception Supabase imports"
  );

  source = replaceOnce(
    source,
    '  const [loading, setLoading] = useState(true);',
    '  const [loading, setLoading] = useState(true);\n  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);\n  const completionLocksRef = useRef(new Set<string>());',
    "reception waiting state"
  );

  source = replaceOnce(
    source,
    '  const appointments = useMemo<AppointmentRow[]>(\n    () => (stats?.todayAppointmentList ?? []) as AppointmentRow[],\n    [stats?.todayAppointmentList]\n  );',
    '  async function completeAppointment(item: AppointmentRow) {\n    if (completionLocksRef.current.has(item.id)) return;\n\n    const name = item.patients?.name || "this patient";\n    const confirmed =\n      Platform.OS === "web"\n        ? globalThis.confirm?.(`Mark ${name} completed?`) ?? false\n        : true;\n    if (!confirmed) return;\n\n    completionLocksRef.current.add(item.id);\n    setBusyAppointmentId(item.id);\n    try {\n      await updateAppointmentStatus(item.id, "completed");\n      await load();\n    } catch (error) {\n      Alert.alert("Complete failed", error instanceof Error ? error.message : "Please try again.");\n    } finally {\n      completionLocksRef.current.delete(item.id);\n      setBusyAppointmentId(null);\n    }\n  }\n\n  async function rescheduleAppointment(item: AppointmentRow) {\n    const current = new Date(item.appointment_time);\n    const suggested = new Date(current.getTime() + 24 * 60 * 60 * 1000);\n    const defaultValue = `${suggested.getFullYear()}-${String(suggested.getMonth() + 1).padStart(2, "0")}-${String(suggested.getDate()).padStart(2, "0")}T${String(suggested.getHours()).padStart(2, "0")}:${String(suggested.getMinutes()).padStart(2, "0")}`;\n    const value =\n      Platform.OS === "web"\n        ? globalThis.prompt?.("Choose the new appointment date and time (YYYY-MM-DDTHH:mm)", defaultValue)\n        : null;\n    if (!value) return;\n\n    const nextTime = new Date(value);\n    if (Number.isNaN(nextTime.getTime()) || nextTime.getTime() <= Date.now()) {\n      Alert.alert("Invalid date", "Choose a valid future appointment date and time.");\n      return;\n    }\n\n    setBusyAppointmentId(item.id);\n    try {\n      const { error } = await supabase\n        .from("appointments")\n        .update({ appointment_time: nextTime.toISOString(), status: "scheduled" })\n        .eq("id", item.id);\n      if (error) throw error;\n      await load();\n    } catch (error) {\n      Alert.alert("Reschedule failed", error instanceof Error ? error.message : "Please try again.");\n    } finally {\n      setBusyAppointmentId(null);\n    }\n  }\n\n  const appointments = useMemo<AppointmentRow[]>(\n    () => (stats?.todayAppointmentList ?? []) as AppointmentRow[],\n    [stats?.todayAppointmentList]\n  );',
    "reception waiting handlers"
  );

  source = replaceOnce(
    source,
    '              <WaitingRow\n                key={item.id}\n                item={item}\n                isLast={index === waiting.length - 1}\n              />',
    '              <WaitingRow\n                key={item.id}\n                item={item}\n                isLast={index === waiting.length - 1}\n                busy={busyAppointmentId === item.id}\n                onReschedule={() => void rescheduleAppointment(item)}\n                onCompleted={() => void completeAppointment(item)}\n              />',
    "reception waiting row props"
  );

  source = replaceOnce(
    source,
    'function WaitingRow({ item, isLast }: { item: AppointmentRow; isLast: boolean }) {\n  return (\n    <Pressable\n      accessibilityRole="button"\n      onPress={() => router.push(`/patient/${item.patient_id}` as never)}\n      style={({ pressed }) => ({\n        minHeight: 72,\n        paddingVertical: 11,\n        paddingHorizontal: 14,\n        flexDirection: "row",\n        alignItems: "center",\n        gap: 12,\n        borderBottomWidth: isLast ? 0 : 1,\n        borderBottomColor: colors.border,\n        backgroundColor: pressed ? colors.surfaceSoft : colors.surface,\n      })}\n    >\n      <View\n        style={{\n          width: 42,\n          height: 42,\n          borderRadius: 16,\n          backgroundColor: colors.warningSoft,\n          alignItems: "center",\n          justifyContent: "center",\n        }}\n      >\n        <Ionicons name="time-outline" size={21} color={colors.warning} />\n      </View>\n      <View style={{ flex: 1, minWidth: 0 }}>\n        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>\n          {item.patients?.name || "Patient"}\n        </Text>\n        <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>\n          {appointmentTime(item.appointment_time)}\n          {item.patients?.phone ? ` - ${item.patients.phone}` : ""}\n        </Text>\n      </View>\n      <StatusBadge label={item.status || "Waiting"} tone="warning" />\n      <Ionicons name="chevron-forward" size={18} color={colors.muted} />\n    </Pressable>\n  );\n}',
    'function WaitingRow({\n  item,\n  isLast,\n  busy,\n  onReschedule,\n  onCompleted,\n}: {\n  item: AppointmentRow;\n  isLast: boolean;\n  busy: boolean;\n  onReschedule: () => void;\n  onCompleted: () => void;\n}) {\n  return (\n    <View\n      style={{\n        minHeight: 72,\n        paddingVertical: 10,\n        paddingHorizontal: 12,\n        flexDirection: "row",\n        alignItems: "center",\n        gap: 8,\n        borderBottomWidth: isLast ? 0 : 1,\n        borderBottomColor: colors.border,\n        backgroundColor: colors.surface,\n      }}\n    >\n      <Pressable\n        accessibilityRole="button"\n        accessibilityLabel={`Open ${item.patients?.name || "patient"}`}\n        onPress={() => router.push(`/patient/${item.patient_id}` as never)}\n        style={({ pressed }) => ({\n          flex: 1,\n          minWidth: 0,\n          minHeight: 50,\n          flexDirection: "row",\n          alignItems: "center",\n          gap: 10,\n          borderRadius: 14,\n          backgroundColor: pressed ? colors.surfaceSoft : colors.surface,\n        })}\n      >\n        <View\n          style={{\n            width: 42,\n            height: 42,\n            borderRadius: 16,\n            backgroundColor: colors.warningSoft,\n            alignItems: "center",\n            justifyContent: "center",\n          }}\n        >\n          <Ionicons name="time-outline" size={21} color={colors.warning} />\n        </View>\n        <View style={{ flex: 1, minWidth: 0 }}>\n          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>\n            {item.patients?.name || "Patient"}\n          </Text>\n          <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>\n            {appointmentTime(item.appointment_time)}\n            {item.patients?.phone ? ` • ${item.patients.phone}` : ""}\n          </Text>\n        </View>\n      </Pressable>\n\n      <View style={{ flexDirection: "row", gap: 8 }}>\n        <Pressable\n          disabled={busy}\n          accessibilityRole="button"\n          accessibilityLabel="Reschedule appointment"\n          onPress={onReschedule}\n          style={({ pressed }) => ({\n            width: 44,\n            height: 44,\n            borderRadius: 14,\n            alignItems: "center",\n            justifyContent: "center",\n            backgroundColor: pressed ? colors.surfaceSoft : colors.primarySoft,\n            borderWidth: 1,\n            borderColor: colors.border,\n            opacity: busy ? 0.55 : 1,\n          })}\n        >\n          <Ionicons name="calendar-number-outline" size={22} color={colors.primary} />\n        </Pressable>\n        <Pressable\n          disabled={busy}\n          accessibilityRole="button"\n          accessibilityLabel="Mark appointment completed"\n          onPress={onCompleted}\n          style={({ pressed }) => ({\n            width: 44,\n            height: 44,\n            borderRadius: 14,\n            alignItems: "center",\n            justifyContent: "center",\n            backgroundColor: pressed ? colors.surfaceSoft : colors.successSoft,\n            borderWidth: 1,\n            borderColor: colors.border,\n            opacity: busy ? 0.55 : 1,\n          })}\n        >\n          <Ionicons name="checkmark-circle" size={24} color={colors.success} />\n        </Pressable>\n      </View>\n    </View>\n  );\n}',
    "reception v18 waiting row"
  );

  fs.writeFileSync(files.reception, source, "utf8");
}

function patchHead() {
  let source = fs.readFileSync(files.head, "utf8");

  source = replaceOnce(
    source,
    'import { useEffect, useMemo, useState, type ComponentProps } from "react";\nimport { Alert, Pressable, Text, useWindowDimensions, View } from "react-native";',
    'import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";\nimport { Alert, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";',
    "head React imports"
  );

  source = replaceOnce(
    source,
    '  getWorkflowDashboardSummary,\n} from "@/lib/supabase";',
    '  getWorkflowDashboardSummary,\n  supabase,\n  updateAppointmentStatus,\n} from "@/lib/supabase";',
    "head Supabase imports"
  );

  source = replaceOnce(
    source,
    '  const [loading, setLoading] = useState(true);\n  const compactBasis = width < 380 ? "100%" : "47%";',
    '  const [loading, setLoading] = useState(true);\n  const [busyAppointmentId, setBusyAppointmentId] = useState<string | null>(null);\n  const completionLocksRef = useRef(new Set<string>());\n  const compactBasis = width < 380 ? "100%" : "47%";',
    "head waiting state"
  );

  source = replaceOnce(
    source,
    '  const appointments = useMemo<AppointmentRow[]>(\n    () => (stats?.todayAppointmentList ?? []) as AppointmentRow[],\n    [stats?.todayAppointmentList]\n  );',
    '  async function completeAppointment(item: AppointmentRow) {\n    if (completionLocksRef.current.has(item.id)) return;\n    const name = item.patients?.name || "this patient";\n    const confirmed =\n      Platform.OS === "web"\n        ? globalThis.confirm?.(`Mark ${name} completed?`) ?? false\n        : true;\n    if (!confirmed) return;\n\n    completionLocksRef.current.add(item.id);\n    setBusyAppointmentId(item.id);\n    try {\n      await updateAppointmentStatus(item.id, "completed");\n      await load();\n    } catch (error) {\n      Alert.alert("Complete failed", error instanceof Error ? error.message : "Please try again.");\n    } finally {\n      completionLocksRef.current.delete(item.id);\n      setBusyAppointmentId(null);\n    }\n  }\n\n  async function rescheduleAppointment(item: AppointmentRow) {\n    const current = new Date(item.appointment_time);\n    const suggested = new Date(current.getTime() + 24 * 60 * 60 * 1000);\n    const defaultValue = `${suggested.getFullYear()}-${String(suggested.getMonth() + 1).padStart(2, "0")}-${String(suggested.getDate()).padStart(2, "0")}T${String(suggested.getHours()).padStart(2, "0")}:${String(suggested.getMinutes()).padStart(2, "0")}`;\n    const value =\n      Platform.OS === "web"\n        ? globalThis.prompt?.("Choose the new appointment date and time (YYYY-MM-DDTHH:mm)", defaultValue)\n        : null;\n    if (!value) return;\n\n    const nextTime = new Date(value);\n    if (Number.isNaN(nextTime.getTime()) || nextTime.getTime() <= Date.now()) {\n      Alert.alert("Invalid date", "Choose a valid future appointment date and time.");\n      return;\n    }\n\n    setBusyAppointmentId(item.id);\n    try {\n      const { error } = await supabase\n        .from("appointments")\n        .update({ appointment_time: nextTime.toISOString(), status: "scheduled" })\n        .eq("id", item.id);\n      if (error) throw error;\n      await load();\n    } catch (error) {\n      Alert.alert("Reschedule failed", error instanceof Error ? error.message : "Please try again.");\n    } finally {\n      setBusyAppointmentId(null);\n    }\n  }\n\n  const appointments = useMemo<AppointmentRow[]>(\n    () => (stats?.todayAppointmentList ?? []) as AppointmentRow[],\n    [stats?.todayAppointmentList]\n  );',
    "head waiting handlers"
  );

  source = replaceOnce(
    source,
    '              <WaitingRow\n                key={item.id}\n                item={item}\n                isLast={index === waiting.length - 1}\n              />',
    '              <WaitingRow\n                key={item.id}\n                item={item}\n                isLast={index === waiting.length - 1}\n                busy={busyAppointmentId === item.id}\n                onReschedule={() => void rescheduleAppointment(item)}\n                onCompleted={() => void completeAppointment(item)}\n              />',
    "head waiting row props"
  );

  source = replaceOnce(
    source,
    'function WaitingRow({ item, isLast }: { item: AppointmentRow; isLast: boolean }) {\n  return (\n    <Pressable\n      accessibilityRole="button"\n      accessibilityLabel={`Open ${item.patients?.name || "patient"}`}\n      onPress={() => router.push(`/patient/${item.patient_id}` as never)}\n      style={({ pressed }) => ({\n        minHeight: 74,\n        paddingHorizontal: 14,\n        paddingVertical: 11,\n        flexDirection: "row",\n        alignItems: "center",\n        gap: 12,\n        borderBottomWidth: isLast ? 0 : 1,\n        borderBottomColor: colors.border,\n        backgroundColor: pressed ? colors.surfaceSoft : colors.surface,\n      })}\n    >\n      <View\n        style={{\n          width: 42,\n          height: 42,\n          borderRadius: 15,\n          backgroundColor: colors.warningSoft,\n          alignItems: "center",\n          justifyContent: "center",\n        }}\n      >\n        <Ionicons name="time-outline" size={21} color={colors.warning} />\n      </View>\n      <View style={{ flex: 1, minWidth: 0 }}>\n        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>\n          {item.patients?.name || "Patient"}\n        </Text>\n        <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>\n          {appointmentTime(item.appointment_time)}\n          {item.patients?.phone ? ` - ${item.patients.phone}` : ""}\n        </Text>\n      </View>\n      <Ionicons name="chevron-forward" size={18} color={colors.muted} />\n    </Pressable>\n  );\n}',
    'function WaitingRow({\n  item,\n  isLast,\n  busy,\n  onReschedule,\n  onCompleted,\n}: {\n  item: AppointmentRow;\n  isLast: boolean;\n  busy: boolean;\n  onReschedule: () => void;\n  onCompleted: () => void;\n}) {\n  return (\n    <View\n      style={{\n        minHeight: 74,\n        paddingHorizontal: 12,\n        paddingVertical: 10,\n        flexDirection: "row",\n        alignItems: "center",\n        gap: 8,\n        borderBottomWidth: isLast ? 0 : 1,\n        borderBottomColor: colors.border,\n        backgroundColor: colors.surface,\n      }}\n    >\n      <Pressable\n        accessibilityRole="button"\n        accessibilityLabel={`Open ${item.patients?.name || "patient"}`}\n        onPress={() => router.push(`/patient/${item.patient_id}` as never)}\n        style={({ pressed }) => ({\n          flex: 1,\n          minWidth: 0,\n          minHeight: 50,\n          flexDirection: "row",\n          alignItems: "center",\n          gap: 10,\n          borderRadius: 14,\n          backgroundColor: pressed ? colors.surfaceSoft : colors.surface,\n        })}\n      >\n        <View\n          style={{\n            width: 42,\n            height: 42,\n            borderRadius: 15,\n            backgroundColor: colors.warningSoft,\n            alignItems: "center",\n            justifyContent: "center",\n          }}\n        >\n          <Ionicons name="time-outline" size={21} color={colors.warning} />\n        </View>\n        <View style={{ flex: 1, minWidth: 0 }}>\n          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>\n            {item.patients?.name || "Patient"}\n          </Text>\n          <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 3 }}>\n            {appointmentTime(item.appointment_time)}\n            {item.patients?.phone ? ` • ${item.patients.phone}` : ""}\n          </Text>\n        </View>\n      </Pressable>\n\n      <View style={{ flexDirection: "row", gap: 8 }}>\n        <Pressable\n          disabled={busy}\n          accessibilityRole="button"\n          accessibilityLabel="Reschedule appointment"\n          onPress={onReschedule}\n          style={({ pressed }) => ({\n            width: 44,\n            height: 44,\n            borderRadius: 14,\n            alignItems: "center",\n            justifyContent: "center",\n            backgroundColor: pressed ? colors.surfaceSoft : colors.primarySoft,\n            borderWidth: 1,\n            borderColor: colors.border,\n            opacity: busy ? 0.55 : 1,\n          })}\n        >\n          <Ionicons name="calendar-number-outline" size={22} color={colors.primary} />\n        </Pressable>\n        <Pressable\n          disabled={busy}\n          accessibilityRole="button"\n          accessibilityLabel="Mark appointment completed"\n          onPress={onCompleted}\n          style={({ pressed }) => ({\n            width: 44,\n            height: 44,\n            borderRadius: 14,\n            alignItems: "center",\n            justifyContent: "center",\n            backgroundColor: pressed ? colors.surfaceSoft : colors.successSoft,\n            borderWidth: 1,\n            borderColor: colors.border,\n            opacity: busy ? 0.55 : 1,\n          })}\n        >\n          <Ionicons name="checkmark-circle" size={24} color={colors.success} />\n        </Pressable>\n      </View>\n    </View>\n  );\n}',
    "head v18 waiting row"
  );

  fs.writeFileSync(files.head, source, "utf8");
}

patchReception();
patchHead();
console.log("Prepared v18 waiting-room actions for web.");
