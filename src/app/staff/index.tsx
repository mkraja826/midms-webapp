import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { ActionCard } from "@/components/ActionCard";
import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/constants/colors";
import {
  getRoleLabel,
  getStaff,
  getStaffInvites,
  Profile,
  StaffInvite,
} from "@/lib/supabase";

export default function StaffManagementScreen() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffError, setStaffError] = useState("");
  const [inviteError, setInviteError] = useState("");

  async function load() {
    setLoading(true);
    setStaffError("");
    setInviteError("");

    try {
      const staffRows = await getStaff();
      setStaff(staffRows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load staff.";
      setStaffError(message);
      console.warn("getStaff failed:", error);
    }

    try {
      const inviteRows = await getStaffInvites();
      setInvites(inviteRows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load invites.";
      setInviteError(message);
      console.warn("getStaffInvites failed:", error);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const pendingInvites = invites.filter((invite) => !invite.accepted_at);

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>
          Staff
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
          Manage clinic staff access, active roles, and pending invite codes.
        </Text>
      </View>

      <SectionCard title="Quick Action" subtitle="Invite working doctors or receptionists with the correct role.">
        <ActionCard
          title="Invite Staff"
          subtitle="Add a working doctor or receptionist"
          icon="person-add-outline"
          onPress={() => router.push("/staff/add" as never)}
        />
      </SectionCard>

      {staffError || inviteError ? (
        <SectionCard title="Setup Warning" subtitle="Staff access needs attention before owner can fully manage team.">
          <Text style={{ color: colors.warning, fontWeight: "900" }}>
            Staff page opened, but one database query failed.
          </Text>

          {staffError ? (
            <Text selectable style={{ color: colors.muted, lineHeight: 20 }}>
              Staff query: {staffError}
            </Text>
          ) : null}

          {inviteError ? (
            <Text selectable style={{ color: colors.muted, lineHeight: 20 }}>
              Invite query: {inviteError}
            </Text>
          ) : null}

          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            Ask the developer to verify staff setup, then press Refresh.
          </Text>
        </SectionCard>
      ) : null}

      <SectionCard title="Active Staff" subtitle="People who currently have clinic access. Check role and active status.">
        {loading ? (
          <Text style={{ color: colors.muted }}>Loading staff...</Text>
        ) : staff.length ? (
          <View style={{ gap: 10 }}>
            {staff.map((member) => (
              <View
                key={member.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="person-outline" size={21} color={colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "900" }}>
                    {member.name}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>
                    {member.email || "No email"}
                  </Text>
                </View>

                <StatusBadge
                  label={getRoleLabel(member.role)}
                  tone={member.active ? "success" : "danger"}
                />
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No staff yet"
            message="Invite your wife as working doctor and assistants as receptionists."
            icon="people-outline"
          />
        )}
      </SectionCard>

      <SectionCard title="Pending Invites" subtitle="Share invite code only with trusted clinic staff.">
        {loading ? (
          <Text style={{ color: colors.muted }}>Loading invites...</Text>
        ) : pendingInvites.length ? (
          <View style={{ gap: 10 }}>
            {pendingInvites.map((invite) => (
              <Pressable
                key={invite.id}
                style={{
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {invite.name}
                </Text>
                <Text style={{ color: colors.muted }}>{invite.email}</Text>
                <Text selectable style={{ color: colors.primary, fontWeight: "900" }}>
                  Invite Code: {invite.invite_code}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No pending invites"
            message="New staff invite codes will appear here."
            icon="mail-open-outline"
          />
        )}
      </SectionCard>

      <AppButton title="Refresh" icon="refresh-outline" variant="secondary" onPress={load} loading={loading} />
    </Screen>
  );
}
