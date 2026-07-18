import { MoreToolsScreen } from "@/components/MoreToolsScreen";
import { receptionWorkflowNavItems } from "@/constants/workflowNav";

export default function ReceptionMoreToolsScreen() {
  return (
    <MoreToolsScreen
      title="More Tools"
      subtitle="Secondary reception work, files, and account actions."
      navItems={receptionWorkflowNavItems}
      sections={[
        {
          title: "Patient Work",
          tools: [
            { title: "Add Old Patient", subtitle: "Enter previous clinic records and opening balance", icon: "archive-outline", target: "/patient/add-old" },
            { title: "Patient Search", subtitle: "Open history, files, visits, and actions", icon: "search-outline", target: "/patient" },
            { title: "Gallery", subtitle: "X-rays, prescriptions, reports, and photos", icon: "images-outline", target: "/gallery" },
          ],
        },
        {
          title: "Collections",
          tools: [
            { title: "Pending Payments", subtitle: "Collect old dues and treatment balances", icon: "wallet-outline", target: "/patient/payment" },
            { title: "OP Fee", subtitle: "Collect OP consultation fee", icon: "receipt-outline", target: { pathname: "/payment/fee", params: { fee_type: "op_fee" } } },
            { title: "X-ray Fee", subtitle: "Collect separate X-ray amount", icon: "scan-outline", target: { pathname: "/payment/fee", params: { fee_type: "xray_fee" } } },
            { title: "Other Fees", subtitle: "Medication, treatment, and clinic fees", icon: "cash-outline", target: "/payment/fee" },
          ],
        },
        {
          title: "Clinic",
          tools: [
            { title: "Reminders", subtitle: "Follow-ups and pending payment reminders", icon: "notifications-outline", target: "/reminders" },
            { title: "Legal & Account", subtitle: "Logout, privacy, support, and account options", icon: "shield-checkmark-outline", target: "/settings/legal" },
            { title: "Change Password", subtitle: "Update your login password", icon: "key-outline", target: "/settings/change-password" },
          ],
        },
      ]}
    />
  );
}
