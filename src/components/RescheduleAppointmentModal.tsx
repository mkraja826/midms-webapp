import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { colors } from "@/constants/colors";

type DateOption = {
  key: string;
  date: Date;
  monthDay: string;
  weekday: string;
  label: string;
};

type TimeSlot = {
  label: string;
  hour: number;
  minute: number;
};

type Props = {
  visible: boolean;
  patientName?: string | null;
  currentAppointmentTime?: string | null;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (nextTime: Date) => void;
};

const TIME_SLOTS: TimeSlot[] = [
  { label: "09:30 AM", hour: 9, minute: 30 },
  { label: "10:00 AM", hour: 10, minute: 0 },
  { label: "10:30 AM", hour: 10, minute: 30 },
  { label: "11:00 AM", hour: 11, minute: 0 },
  { label: "11:30 AM", hour: 11, minute: 30 },
  { label: "12:00 PM", hour: 12, minute: 0 },
  { label: "04:30 PM", hour: 16, minute: 30 },
  { label: "05:00 PM", hour: 17, minute: 0 },
  { label: "05:30 PM", hour: 17, minute: 30 },
  { label: "06:00 PM", hour: 18, minute: 0 },
  { label: "06:30 PM", hour: 18, minute: 30 },
  { label: "07:00 PM", hour: 19, minute: 0 },
  { label: "07:30 PM", hour: 19, minute: 30 },
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function createDateOptions(days = 90): DateOption[] {
  const now = new Date();
  const options: DateOption[] = [];

  for (let index = 0; index < days; index += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + index);
    date.setHours(0, 0, 0, 0);

    options.push({
      key: getDateKey(date),
      date,
      monthDay: date.toLocaleDateString([], { month: "short", day: "numeric" }),
      weekday: date.toLocaleDateString([], { weekday: "short" }),
      label:
        index === 0
          ? "Today"
          : index === 1
            ? "Tomorrow"
            : date.toLocaleDateString([], { weekday: "short" }),
    });
  }

  return options;
}

function makeDateTime(date: Date, slot: TimeSlot) {
  const value = new Date(date);
  value.setHours(slot.hour, slot.minute, 0, 0);
  return value;
}

function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RescheduleAppointmentModal({
  visible,
  patientName,
  currentAppointmentTime,
  saving = false,
  onClose,
  onConfirm,
}: Props) {
  const dateOptions = useMemo(() => createDateOptions(90), [visible]);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);

  useEffect(() => {
    if (!visible || !dateOptions.length) return;

    const currentTime = currentAppointmentTime
      ? new Date(currentAppointmentTime).getTime()
      : Number.NaN;

    for (const option of dateOptions) {
      const firstValidSlotIndex = TIME_SLOTS.findIndex((slot) => {
        const candidate = makeDateTime(option.date, slot).getTime();
        return candidate > Date.now() && candidate !== currentTime;
      });

      if (firstValidSlotIndex >= 0) {
        setSelectedDateKey(option.key);
        setSelectedTimeIndex(firstValidSlotIndex);
        return;
      }
    }

    setSelectedDateKey(dateOptions[0].key);
    setSelectedTimeIndex(0);
  }, [visible, currentAppointmentTime, dateOptions]);

  const selectedDate =
    dateOptions.find((option) => option.key === selectedDateKey) || dateOptions[0];

  const availableTimeSlots = useMemo(() => {
    if (!selectedDate) return [];

    return TIME_SLOTS.map((slot, index) => ({
      ...slot,
      index,
      disabled: makeDateTime(selectedDate.date, slot).getTime() <= Date.now(),
    }));
  }, [selectedDate]);

  useEffect(() => {
    const selectedSlot = availableTimeSlots[selectedTimeIndex];
    if (selectedSlot && !selectedSlot.disabled) return;

    const firstAvailable = availableTimeSlots.find((slot) => !slot.disabled);
    if (firstAvailable) setSelectedTimeIndex(firstAvailable.index);
  }, [availableTimeSlots, selectedTimeIndex]);

  const selectedTime = TIME_SLOTS[selectedTimeIndex] || TIME_SLOTS[0];
  const selectedDateTime = selectedDate
    ? makeDateTime(selectedDate.date, selectedTime)
    : null;
  const currentTime = currentAppointmentTime
    ? new Date(currentAppointmentTime).getTime()
    : Number.NaN;
  const unchanged = selectedDateTime?.getTime() === currentTime;
  const canConfirm = Boolean(
    selectedDateTime && selectedDateTime.getTime() > Date.now() && !unchanged && !saving
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15, 23, 42, 0.48)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 680,
            maxHeight: "92%",
            alignSelf: "center",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primarySoft,
              }}
            >
              <Ionicons name="calendar-number-outline" size={24} color={colors.primary} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
                Choose Date & Time
              </Text>
              <Text numberOfLines={1} style={{ color: colors.muted, marginTop: 2 }}>
                {patientName || "Patient"}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close reschedule"
              disabled={saving}
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 42,
                height: 42,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? colors.surfaceSoft : colors.background,
                opacity: saving ? 0.5 : 1,
              })}
            >
              <Ionicons name="close" size={23} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 18, gap: 18, paddingBottom: 24 }}
          >
            {currentAppointmentTime ? (
              <View
                style={{
                  padding: 13,
                  borderRadius: 18,
                  backgroundColor: colors.warningSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 4,
                }}
              >
                <Text style={{ color: colors.warning, fontSize: 12, fontWeight: "900" }}>
                  CURRENT APPOINTMENT
                </Text>
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {formatDateTime(currentAppointmentTime)}
                </Text>
              </View>
            ) : null}

            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>Date</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingRight: 12 }}
              >
                {dateOptions.map((option) => {
                  const selected = option.key === selectedDateKey;
                  const hasFutureSlot = TIME_SLOTS.some(
                    (slot) => makeDateTime(option.date, slot).getTime() > Date.now()
                  );

                  return (
                    <Pressable
                      key={option.key}
                      disabled={!hasFutureSlot || saving}
                      onPress={() => setSelectedDateKey(option.key)}
                      style={{
                        width: 86,
                        minHeight: 86,
                        borderRadius: 21,
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary : colors.background,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        opacity: hasFutureSlot ? 1 : 0.32,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? colors.white : colors.muted,
                          fontSize: 11,
                          fontWeight: "900",
                        }}
                      >
                        {option.label}
                      </Text>
                      <Text
                        style={{
                          color: selected ? colors.white : colors.text,
                          fontSize: 18,
                          fontWeight: "900",
                        }}
                      >
                        {option.monthDay}
                      </Text>
                      <Text
                        style={{
                          color: selected ? "rgba(255,255,255,0.78)" : colors.muted,
                          fontSize: 11,
                        }}
                      >
                        {option.weekday}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>Time</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
                {availableTimeSlots.map((slot) => {
                  const selected = slot.index === selectedTimeIndex;

                  return (
                    <Pressable
                      key={slot.label}
                      disabled={slot.disabled || saving}
                      onPress={() => setSelectedTimeIndex(slot.index)}
                      style={{
                        minWidth: 94,
                        minHeight: 46,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary : colors.background,
                        opacity: slot.disabled ? 0.3 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? colors.white : colors.text,
                          fontWeight: "900",
                        }}
                      >
                        {slot.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {selectedDateTime ? (
              <View
                style={{
                  padding: 13,
                  borderRadius: 18,
                  backgroundColor: unchanged ? colors.warningSoft : colors.successSoft,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    color: unchanged ? colors.warning : colors.success,
                    fontSize: 12,
                    fontWeight: "900",
                  }}
                >
                  {unchanged ? "CHOOSE A DIFFERENT TIME" : "NEW APPOINTMENT"}
                </Text>
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {formatDateTime(selectedDateTime)}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={{
              padding: 16,
              paddingBottom: 20,
              flexDirection: "row",
              gap: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel reschedule"
              disabled={saving}
              onPress={onClose}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 52,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceSoft : colors.background,
                opacity: saving ? 0.5 : 1,
              })}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>Cancel</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm new appointment date and time"
              accessibilityState={{ disabled: !canConfirm, busy: saving }}
              disabled={!canConfirm}
              onPress={() => {
                if (selectedDateTime) onConfirm(selectedDateTime);
              }}
              style={({ pressed }) => ({
                flex: 1.4,
                minHeight: 52,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                backgroundColor: canConfirm
                  ? pressed
                    ? colors.primaryDark
                    : colors.primary
                  : colors.border,
              })}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="calendar-number-outline" size={19} color={colors.white} />
                  <Text style={{ color: colors.white, fontWeight: "900" }}>Confirm</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
