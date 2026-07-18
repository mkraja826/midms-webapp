import { MoreToolsScreen } from "@/components/MoreToolsScreen";
import { headWorkflowNavItems } from "@/constants/workflowNav";

export default function HeadMoreToolsScreen() {
  return (
    <MoreToolsScreen
      title="More"
      subtitle="Owner tools, reports, staff, plans, and account."
      navItems={headWorkflowNavItems}
      sections={[
        {
          title: "Owner Review",
          tools: [
            { title: "Clinic Report", subtitle: "Daily closing summary and clinic activity", icon: "analytics-outline", target: "/reports/clinic" },
            { title: "Payments", subtitle: "Collections, dues, and pending balances", icon: "wallet-outline", target: "/billing" },
            { title: "Patients", subtitle: "Profiles, visits, files, and payment status", icon: "search-outline", target: "/patient" },
          ],
        },
        {
          title: "Clinic Control",
          tools: [
            { title: "Check-in", subtitle: "Register walk-ins and send patients to waiting", icon: "send-outline", target: "/reception/checkin" },
            { title: "Book Appointment", subtitle: "Schedule patient visits and follow-ups", icon: "calendar-number-outline", target: "/appointment/book" },
            { title: "Reminders", subtitle: "Follow-ups and pending payment reminders", icon: "notifications-outline", target: "/reminders" },
            { title: "Gallery", subtitle: "X-rays, prescriptions, reports, and photos", icon: "images-outline", target: "/gallery" },
          ],
        },
        {
          title: "Admin",
          tools: [
            { title: "Staff", subtitle: "Invite and manage clinic access", icon: "people-circle-outline", target: "/staff" },
            { title: "Clinic Branding", subtitle: "Logo and clinic identity", icon: "brush-outline", target: "/clinic/branding" },
            { title: "View Plans", subtitle: "Free plan and future storage options", icon: "card-outline", target: "/settings/subscription" },
            { title: "Legal & Account", subtitle: "Logout, support, privacy, and settings", icon: "shield-checkmark-outline", target: "/settings/legal" },
          ],
        },
      ]}
    />
  );
}
