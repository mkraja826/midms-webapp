import { Profile, Role, supabase } from "@/lib/supabase";

export type StaffEditableRole = "working_doctor" | "receptionist";

export function isOwnerRole(role?: Role | null) {
  return role === "owner" || role === "head_doctor";
}

export function isEditableStaffRole(role?: Role | null): role is StaffEditableRole {
  return role === "working_doctor" || role === "receptionist" || role === "doctor";
}

export function normalizeEditableRole(role?: Role | null): StaffEditableRole {
  if (role === "receptionist") return "receptionist";
  return "working_doctor";
}

export async function updateStaffAccess(input: {
  staffId: string;
  role?: StaffEditableRole | null;
  active?: boolean | null;
}) {
  const { data, error } = await supabase.rpc("owner_update_staff_access", {
    p_staff_id: input.staffId,
    p_staff_role: input.role ?? null,
    p_staff_active: typeof input.active === "boolean" ? input.active : null,
  });

  if (error) throw error;
  return data as Profile;
}

export async function updateStaffRole(staffId: string, role: StaffEditableRole) {
  return updateStaffAccess({ staffId, role, active: null });
}

export async function setStaffActive(staffId: string, active: boolean) {
  return updateStaffAccess({ staffId, role: null, active });
}
