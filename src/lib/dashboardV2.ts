import {
  DashboardStats,
  WorkflowDashboardSummary,
  getDashboardStats,
  getWorkflowDashboardSummary,
  supabase,
} from "@/lib/supabase";

export type ClinicDashboardV2 = {
  stats: DashboardStats;
  summary: WorkflowDashboardSummary;
};

export type ClinicDashboardResult = {
  stats: DashboardStats;
  summary: WorkflowDashboardSummary | null;
  source: "v2" | "legacy";
};

/**
 * Loads the additive dashboard v2 RPC.
 */
export async function getClinicDashboardV2(): Promise<ClinicDashboardV2> {
  const { data, error } = await supabase.rpc("get_clinic_dashboard_v2");

  if (error) throw error;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Dashboard v2 returned an invalid response.");
  }

  const response = data as Partial<ClinicDashboardV2>;

  if (!response.stats || !response.summary) {
    throw new Error("Dashboard v2 response is incomplete.");
  }

  return {
    stats: response.stats,
    summary: response.summary,
  };
}

/**
 * Uses dashboard v2 only when requested. If the new RPC is unavailable for any
 * reason, the current production dashboard queries remain the automatic
 * fallback so clinic work can continue normally.
 */
export async function getClinicDashboardSafe({
  force = false,
  preferV2 = false,
}: {
  force?: boolean;
  preferV2?: boolean;
} = {}): Promise<ClinicDashboardResult> {
  if (preferV2) {
    try {
      const dashboard = await getClinicDashboardV2();
      return { ...dashboard, source: "v2" };
    } catch (error) {
      console.warn(
        "Dashboard v2 unavailable; using legacy loader:",
        error instanceof Error ? error.message : error
      );
    }
  }

  const [stats, summary] = await Promise.all([
    getDashboardStats({ force }),
    getWorkflowDashboardSummary({ force }),
  ]);

  return {
    stats,
    summary,
    source: "legacy",
  };
}
