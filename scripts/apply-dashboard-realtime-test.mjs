import { readFileSync, writeFileSync } from "node:fs";

const revert = process.argv.includes("--revert");

function occurrenceCount(text, value) {
  return text.split(value).length - 1;
}

function replaceSafely(text, oldValue, newValue, label) {
  const from = revert ? newValue : oldValue;
  const to = revert ? oldValue : newValue;

  if (text.includes(to) && !text.includes(from)) {
    console.log(`${label}: already ${revert ? "reverted" : "applied"}`);
    return text;
  }

  const count = occurrenceCount(text, from);
  if (count !== 1) {
    throw new Error(`${label}: expected one source block, found ${count}`);
  }

  console.log(`${label}: ${revert ? "reverted" : "applied"}`);
  return text.replace(from, to);
}

function patchFile(path, replacements) {
  let text = readFileSync(path, "utf8");

  for (const replacement of replacements) {
    text = replaceSafely(
      text,
      replacement.oldValue,
      replacement.newValue,
      replacement.label
    );
  }

  writeFileSync(path, text, "utf8");
}

const ownerImportsOld = `import { getClinicPreferences } from "@/lib/clinicPreferences";
import {
  DashboardStats,
  WorkflowDashboardSummary,
  getDashboardStats,
  getRoleLabel,
  getWorkflowDashboardSummary,
  rescheduleAppointment,
  updateAppointmentStatus,
} from "@/lib/supabase";`;

const ownerImportsNew = `import { getClinicPreferences } from "@/lib/clinicPreferences";
import { getClinicDashboardSafe } from "@/lib/dashboardV2";
import {
  isClinicRealtimeEnabled,
  subscribeClinicDashboardRealtime,
} from "@/lib/realtime";
import {
  DashboardStats,
  WorkflowDashboardSummary,
  getRoleLabel,
  rescheduleAppointment,
  updateAppointmentStatus,
} from "@/lib/supabase";`;

const ownerLoaderOld = `  async function load(force = false) {
    try {
      setLoading(true);
      const [data, row, clinicPreferences] = await Promise.all([
        getDashboardStats({ force }),
        getWorkflowDashboardSummary({ force }),
        getClinicPreferences({ force }).catch(() =>
          getDefaultClinicPreferences()
        ),
      ]);

      setStats(data);
      setSummary(row);
      setCurrencyCode(clinicPreferences.currencyCode);
    } catch (error) {
      Alert.alert(
        "Dashboard load failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);`;

const ownerLoaderNew = `  async function load(force = false, silent = false) {
    try {
      if (!silent) setLoading(true);
      const [dashboard, clinicPreferences] = await Promise.all([
        getClinicDashboardSafe({
          force,
          preferV2: isClinicRealtimeEnabled(),
        }),
        getClinicPreferences({ force }).catch(() =>
          getDefaultClinicPreferences()
        ),
      ]);

      setStats(dashboard.stats);
      setSummary(dashboard.summary);
      setCurrencyCode(clinicPreferences.currencyCode);
    } catch (error) {
      Alert.alert(
        "Dashboard load failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    return subscribeClinicDashboardRealtime({
      clinicId: profile?.clinic_id,
      onChange: () => load(true, true),
    });
  }, [profile?.clinic_id]);`;

const receptionImportsOld = `import {
  ClinicFeatureSettings,
  DEFAULT_CLINIC_FEATURE_SETTINGS,
  getClinicFeatureSettings,
} from "@/lib/clinicOptions";
import {
  DashboardStats,
  getDashboardStats,
  getRoleLabel,
  getWorkflowDashboardSummary,
  rescheduleAppointment,
  supabase,
  updateAppointmentStatus,
} from "@/lib/supabase";`;

const receptionImportsNew = `import {
  ClinicFeatureSettings,
  DEFAULT_CLINIC_FEATURE_SETTINGS,
  getClinicFeatureSettings,
} from "@/lib/clinicOptions";
import { getClinicDashboardSafe } from "@/lib/dashboardV2";
import {
  isClinicRealtimeEnabled,
  subscribeClinicDashboardRealtime,
} from "@/lib/realtime";
import {
  DashboardStats,
  getRoleLabel,
  rescheduleAppointment,
  supabase,
  updateAppointmentStatus,
} from "@/lib/supabase";`;

const receptionLoaderOld = `  async function load(force = false) {
    try {
      setLoading(true);

      const [data, row, featureSettings] = await Promise.all([
        getDashboardStats({ force }),
        getWorkflowDashboardSummary({ force }),
        getClinicFeatureSettings().catch((error) => {
          console.warn("Reception optional features load failed:", error);
          return DEFAULT_CLINIC_FEATURE_SETTINGS;
        }),
      ]);

      setFeatures(featureSettings);

      const { data: appointmentRows, error: appointmentError } = await supabase
        .from("appointments")
        .select("id,patient_id,appointment_time,status,patients(id,name,phone,photo_url)")
        .gte("appointment_time", startOfToday())
        .lte("appointment_time", endOfToday())
        .in("status", ["scheduled", "waiting", "checked_in", "booked"])
        .order("appointment_time", { ascending: true });

      if (!appointmentError && Array.isArray(appointmentRows)) {
        setStats({ ...data, todayAppointmentList: appointmentRows as any });
      } else {
        if (appointmentError) console.warn("Reception photo appointment query failed:", appointmentError.message);
        setStats(data);
      }

      if (row) setSummary(row);
    } catch (error) {
      Alert.alert("Dashboard load failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);`;

const receptionLoaderNew = `  async function load(force = false, silent = false) {
    try {
      if (!silent) setLoading(true);

      const [dashboard, featureSettings] = await Promise.all([
        getClinicDashboardSafe({
          force,
          preferV2: isClinicRealtimeEnabled(),
        }),
        getClinicFeatureSettings().catch((error) => {
          console.warn("Reception optional features load failed:", error);
          return DEFAULT_CLINIC_FEATURE_SETTINGS;
        }),
      ]);

      setFeatures(featureSettings);
      let nextStats = dashboard.stats;

      if (dashboard.source === "legacy") {
        const { data: appointmentRows, error: appointmentError } = await supabase
          .from("appointments")
          .select("id,patient_id,appointment_time,status,patients(id,name,phone,photo_url)")
          .gte("appointment_time", startOfToday())
          .lte("appointment_time", endOfToday())
          .in("status", ["scheduled", "waiting", "checked_in", "booked"])
          .order("appointment_time", { ascending: true });

        if (!appointmentError && Array.isArray(appointmentRows)) {
          nextStats = {
            ...dashboard.stats,
            todayAppointmentList: appointmentRows as any,
          };
        } else if (appointmentError) {
          console.warn(
            "Reception photo appointment query failed:",
            appointmentError.message
          );
        }
      }

      setStats(nextStats);
      setSummary(dashboard.summary);
    } catch (error) {
      Alert.alert(
        "Dashboard load failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();

    return subscribeClinicDashboardRealtime({
      clinicId: profile?.clinic_id,
      onChange: () => load(true, true),
    });
  }, [profile?.clinic_id]);`;

patchFile("src/app/(head)/dashboard.tsx", [
  {
    label: "Owner dashboard imports",
    oldValue: ownerImportsOld,
    newValue: ownerImportsNew,
  },
  {
    label: "Owner dashboard loader",
    oldValue: ownerLoaderOld,
    newValue: ownerLoaderNew,
  },
]);

patchFile("src/app/(reception)/dashboard.tsx", [
  {
    label: "Reception dashboard imports",
    oldValue: receptionImportsOld,
    newValue: receptionImportsNew,
  },
  {
    label: "Reception dashboard loader",
    oldValue: receptionLoaderOld,
    newValue: receptionLoaderNew,
  },
]);

console.log(
  revert
    ? "Dashboard Realtime test wiring reverted."
    : "Dashboard Realtime test wiring applied. Run npm run typecheck next."
);
