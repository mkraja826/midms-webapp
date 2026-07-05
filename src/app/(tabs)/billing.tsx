import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { AppInput } from "@/components/AppInput";
import { QuickAction } from "@/components/QuickAction";
import { SectionCard } from "@/components/SectionCard";
import { StatusChip } from "@/components/StatusChip";
import { addPayment, createInvoice, getPendingPayments, getPatients, Invoice, Patient } from "@/lib/supabase";
import { colors } from "@/constants/colors";
import { openWhatsApp, paymentReminderMessage } from "@/lib/whatsapp";

export default function BillingScreen() {
  const [pending, setPending] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientPhone, setPatientPhone] = useState("");
  const [total, setTotal] = useState("");
  const [paid, setPaid] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [payments, allPatients] = await Promise.all([getPendingPayments(), getPatients()]);
      setPending(payments);
      setPatients(allPatients);
    } catch (error) {
      Alert.alert("Billing error", error instanceof Error ? error.message : "Unable to load billing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveInvoice() {
    const patient = patients.find((item) => item.phone === patientPhone.trim() || item.name.toLowerCase() === patientPhone.trim().toLowerCase());
    if (!patient || !Number(total)) {
      Alert.alert("Missing details", "Enter a patient phone/name and invoice total.");
      return;
    }
    try {
      await createInvoice({ patient_id: patient.id, total_amount: Number(total), paid_amount: Number(paid || 0) });
      setPatientPhone("");
      setTotal("");
      setPaid("");
      await load();
    } catch (error) {
      Alert.alert("Invoice failed", error instanceof Error ? error.message : "Unable to create invoice.");
    }
  }

  async function savePayment() {
    const invoice = pending.find((item) => item.id.startsWith(paymentInvoice.trim()) || item.patients?.phone === paymentInvoice.trim());
    if (!invoice || !Number(paymentAmount)) {
      Alert.alert("Missing details", "Enter an invoice ID prefix or patient phone and payment amount.");
      return;
    }
    try {
      await addPayment({ invoice_id: invoice.id, patient_id: invoice.patient_id, amount: Number(paymentAmount), payment_method: "cash" });
      setPaymentInvoice("");
      setPaymentAmount("");
      await load();
    } catch (error) {
      Alert.alert("Payment failed", error instanceof Error ? error.message : "Unable to add payment.");
    }
  }

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <SectionCard title="Add Invoice" subtitle="Create treatment or service invoice using exact patient phone number or name.">
        <AppInput label="Patient phone or exact name" value={patientPhone} onChangeText={setPatientPhone} />
        <AppInput label="Total amount" value={total} onChangeText={setTotal} keyboardType="numeric" />
        <AppInput label="Paid amount" value={paid} onChangeText={setPaid} keyboardType="numeric" />
        <AppButton title="Create Invoice" icon="receipt-outline" onPress={saveInvoice} />
      </SectionCard>
      <SectionCard title="Add Payment" subtitle="Collect pending amount using invoice ID prefix or patient phone number.">
        <AppInput label="Invoice ID prefix or patient phone" value={paymentInvoice} onChangeText={setPaymentInvoice} />
        <AppInput label="Amount" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="numeric" />
        <AppButton title="Collect Payment" icon="cash-outline" onPress={savePayment} />
      </SectionCard>
      <SectionCard title="Pending Payments" subtitle="Track dues and send WhatsApp payment reminders when needed.">
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {!loading && !pending.length ? <EmptyState title="No pending payments" body="Paid invoices will stay out of this queue." icon="checkmark-circle-outline" /> : null}
        {pending.map((invoice) => (
          <View key={invoice.id} style={{ gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ flex: 1, color: colors.text, fontWeight: "900", fontSize: 16 }}>{invoice.patients?.name ?? "Patient"}</Text>
              <StatusChip label={`Due ₹${invoice.due_amount}`} tone="warning" />
            </View>
            <Text selectable style={{ color: colors.muted }}>Invoice {invoice.id.slice(0, 8)} · Total ₹{invoice.total_amount} · Paid ₹{invoice.paid_amount}</Text>
            <QuickAction
              icon="logo-whatsapp"
              label="Payment reminder"
              onPress={() => openWhatsApp(invoice.patients?.phone, paymentReminderMessage({ patientName: invoice.patients?.name ?? "Patient", dueAmount: Number(invoice.due_amount) }))}
            />
          </View>
        ))}
      </SectionCard>
    </Screen>
  );
}
