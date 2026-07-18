import { MoreToolsScreen } from "@/components/MoreToolsScreen";
import { doctorWorkflowNavItems } from "@/constants/workflowNav";

export default function DoctorMoreToolsScreen() {
  return (
    <MoreToolsScreen
      title="More"
      subtitle="Files, follow-ups, gallery, and account."
      navItems={doctorWorkflowNavItems}
      sections={[
        {
          title: "Clinical Files",
          tools: [
            { title: "Upload X-ray / Prescription", subtitle: "Add files to the selected patient", icon: "cloud-upload-outline", target: "/patient/upload" },
            { title: "Gallery", subtitle: "View X-rays, prescriptions, reports, and photos", icon: "images-outline", target: "/gallery" },
          ],
        },
        {
          title: "Follow-up Work",
          tools: [
            { title: "Follow-up Reminders", subtitle: "Today and overdue review patients", icon: "notifications-outline", target: "/reminders" },
            { title: "Book Follow-up", subtitle: "Schedule the next review appointment", icon: "calendar-number-outline", target: "/appointment/book" },
          ],
        },
        {
          title: "Account",
          tools: [
            { title: "Legal & Account", subtitle: "Logout, privacy, support, and account options", icon: "shield-checkmark-outline", target: "/settings/legal" },
            { title: "Change Password", subtitle: "Update your login password", icon: "key-outline", target: "/settings/change-password" },
          ],
        },
      ]}
    />
  );
}
