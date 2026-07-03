import { Alert, Linking } from "react-native";

function normalizePhone(phone?: string | null) {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
}

export async function openWhatsApp(phone: string | null | undefined, message: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    Alert.alert("Phone missing", "Add a valid phone number before sending WhatsApp.");
    return;
  }

  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    Alert.alert("WhatsApp unavailable", "WhatsApp could not be opened on this device.");
    return;
  }
  await Linking.openURL(url);
}

export function appointmentReminderMessage(input: { patientName: string; clinicName?: string; appointmentTime: string }) {
  return `Hello ${input.patientName}, this is a reminder for your dental appointment at ${input.clinicName ?? "our clinic"} on ${new Date(input.appointmentTime).toLocaleString()}. Please reply to confirm or call us to reschedule.`;
}

export function paymentReminderMessage(input: { patientName: string; clinicName?: string; dueAmount: number }) {
  return `Hello ${input.patientName}, this is a gentle reminder that ₹${input.dueAmount} is pending at ${input.clinicName ?? "our clinic"}. Please contact reception if you have already paid.`;
}

export function visitFollowUpMessage(input: { patientName: string; clinicName?: string }) {
  return `Hello ${input.patientName}, thank you for visiting ${input.clinicName ?? "our clinic"}. Please follow the doctor's advice and contact us if you have pain, swelling, or questions.`;
}
