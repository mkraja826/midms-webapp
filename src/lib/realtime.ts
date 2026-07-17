import { invalidateAppDataCache, supabase } from "@/lib/supabase";

const REALTIME_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_REALTIME === "true";

export function isClinicRealtimeEnabled() {
  return REALTIME_ENABLED;
}

type DashboardRealtimeOptions = {
  clinicId?: string | null;
  onChange: () => void | Promise<void>;
  debounceMs?: number;
};

/**
 * Creates one clinic-filtered channel for dashboard-changing records.
 *
 * This helper is intentionally disabled unless
 * EXPO_PUBLIC_ENABLE_REALTIME=true. Existing clinic screens do not import it
 * yet, so adding this file cannot change the current clinic workflow.
 */
export function subscribeClinicDashboardRealtime({
  clinicId,
  onChange,
  debounceMs = 450,
}: DashboardRealtimeOptions) {
  if (!REALTIME_ENABLED || !clinicId) {
    return () => undefined;
  }

  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const scheduleRefresh = (scopes: Array<"dashboard" | "appointments" | "payments">) => {
    scopes.forEach((scope) => invalidateAppDataCache(scope));

    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (disposed) return;

      Promise.resolve(onChange()).catch((error) => {
        console.warn("Realtime dashboard refresh failed:", error);
      });
    }, Math.max(200, debounceMs));
  };

  const channel = supabase
    .channel(`clinic-dashboard:${clinicId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "appointments",
        filter: `clinic_id=eq.${clinicId}`,
      },
      () => scheduleRefresh(["dashboard", "appointments"])
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "payments",
        filter: `clinic_id=eq.${clinicId}`,
      },
      () => scheduleRefresh(["dashboard", "payments"])
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "invoices",
        filter: `clinic_id=eq.${clinicId}`,
      },
      () => scheduleRefresh(["dashboard", "payments"])
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`Clinic Realtime channel status: ${status}`);
      }
    });

  return () => {
    disposed = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
    void supabase.removeChannel(channel);
  };
}
