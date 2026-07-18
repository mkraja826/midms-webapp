import { type WorkflowBottomNavItem } from "@/components/WorkflowBottomNav";

export const doctorWorkflowNavItems: WorkflowBottomNavItem[] = [
  { key: "home", label: "Home", icon: "home-outline", href: "/(doctor)/dashboard", replace: true },
  { key: "visit", label: "Visit", icon: "create-outline", href: "/patient/visit" },
  { key: "patients", label: "Patients", icon: "search-outline", href: "/patient" },
  { key: "treatments", label: "Treatments", icon: "git-branch-outline", href: "/treatments/ongoing" },
  { key: "more", label: "More", icon: "grid-outline", href: "/(doctor)/more" },
];

export const headWorkflowNavItems: WorkflowBottomNavItem[] = [
  { key: "home", label: "Home", icon: "home-outline", href: "/(head)/dashboard", replace: true },
  { key: "patients", label: "Patients", icon: "search-outline", href: "/patient" },
  { key: "money", label: "Money", icon: "wallet-outline", href: "/reports/payments" },
  { key: "treatments", label: "Treatments", icon: "git-branch-outline", href: "/treatments/ongoing" },
  { key: "more", label: "More", icon: "grid-outline", href: "/(head)/more" },
];

export const receptionWorkflowNavItems: WorkflowBottomNavItem[] = [
  { key: "home", label: "Home", icon: "home-outline", href: "/(reception)/dashboard", replace: true },
  { key: "checkin", label: "Check-in", icon: "send-outline", href: "/reception/checkin" },
  { key: "patients", label: "Patients", icon: "search-outline", href: "/patient" },
  { key: "payments", label: "Payments", icon: "cash-outline", href: "/payment/fee" },
  { key: "more", label: "More", icon: "grid-outline", href: "/(reception)/more" },
];
