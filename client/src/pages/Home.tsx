import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  CheckCircle,
  Clock,
  TrendingUp,
  Shield,
  FileText,
  ChevronRight,
  Activity,
  BarChart2,
  AlertCircle,
} from "lucide-react";

function MetricCard({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`border border-border p-6 ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <div className={`label-caps mb-3 ${accent ? "text-primary-foreground/70" : ""}`}>{label}</div>
      <div className={`text-4xl font-black tracking-[-0.04em] leading-none ${accent ? "text-primary-foreground" : ""}`}>
        {value ?? "—"}
        {unit && <span className="text-xl font-medium ml-1">{unit}</span>}
      </div>
      {sub && (
        <div className={`text-xs mt-2 ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function DecisionBar({
  approved,
  conditional,
  denied,
  total,
}: {
  approved: number;
  conditional: number;
  denied: number;
  total: number;
}) {
  if (total === 0) return <div className="h-3 bg-muted w-full" />;
  const approvedPct = (approved / total) * 100;
  const conditionalPct = (conditional / total) * 100;
  const deniedPct = (denied / total) * 100;
  return (
    <div className="flex h-3 w-full overflow-hidden">
      <div style={{ width: `${approvedPct}%` }} className="bg-[oklch(0.55_0.15_145)]" title={`Approved: ${approved}`} />
      <div style={{ width: `${conditionalPct}%` }} className="bg-[oklch(0.70_0.12_80)]" title={`Conditional: ${conditional}`} />
      <div style={{ width: `${deniedPct}%` }} className="bg-primary" title={`Denied: ${denied}`} />
    </div>
  );
}

export default function Home() {
  const { data: metrics, isLoading } = trpc.mortgage.getDashboardMetrics.useQuery();
  const { data: recentApps } = trpc.mortgage.listApplications.useQuery({ limit: 5 });
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-4 h-4 bg-primary flex-shrink-0" />
              <span className="label-caps">AGNTCY — Mortgage Underwriting Platform</span>
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em]">Dashboard</h1>
          </div>
          <button
            onClick={() => setLocation("/apply")}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-primary/90 transition-colors"
          >
            New Application
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-8 py-8 space-y-8">
        {/* Metrics Grid */}
        <div>
          <div className="label-caps mb-4">Performance Metrics</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            <MetricCard
              label="Total Applications"
              value={isLoading ? "…" : metrics?.totalApplications ?? 0}
              sub="Completed pipeline runs"
            />
            <MetricCard
              label="Approval Rate"
              value={isLoading ? "…" : metrics?.approvalRate ?? 0}
              unit="%"
              sub="Approved + Conditional"
              accent
            />
            <MetricCard
              label="Avg. Interest Rate"
              value={isLoading ? "…" : metrics?.avgInterestRate ?? "—"}
              unit="%"
              sub="Risk-based pricing"
            />
            <MetricCard
              label="Compliance Pass Rate"
              value={isLoading ? "…" : metrics?.compliancePassRate ?? 0}
              unit="%"
              sub="Fair Lending + BSA/AML"
            />
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
          <MetricCard
            label="Avg. Processing Time"
            value={isLoading ? "…" : metrics?.avgProcessingTimeSec ?? "—"}
            unit="s"
            sub="End-to-end pipeline"
          />
          <MetricCard
            label="Approved"
            value={isLoading ? "…" : metrics?.approvedCount ?? 0}
            sub="Full approval"
          />
          <MetricCard
            label="Conditional"
            value={isLoading ? "…" : metrics?.conditionalCount ?? 0}
            sub="With conditions"
          />
          <MetricCard
            label="Denied"
            value={isLoading ? "…" : metrics?.deniedCount ?? 0}
            sub="Risk threshold violations"
          />
        </div>

        {/* Decision Distribution */}
        {metrics && metrics.totalApplications > 0 && (
          <div className="border border-border p-6">
            <div className="label-caps mb-4">Decision Distribution</div>
            <DecisionBar
              approved={metrics.approvedCount}
              conditional={metrics.conditionalCount}
              denied={metrics.deniedCount}
              total={metrics.totalApplications}
            />
            <div className="flex gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[oklch(0.55_0.15_145)]" />
                <span className="text-xs text-muted-foreground">
                  Approved ({metrics.approvedCount})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[oklch(0.70_0.12_80)]" />
                <span className="text-xs text-muted-foreground">
                  Conditional ({metrics.conditionalCount})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary" />
                <span className="text-xs text-muted-foreground">
                  Denied ({metrics.deniedCount})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Agent Performance */}
        {metrics && metrics.agentStats.length > 0 && (
          <div className="border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <Activity className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm uppercase tracking-wide">Agent Performance</span>
            </div>
            <div className="divide-y divide-border">
              {metrics.agentStats.map((agent) => (
                <div key={agent.agentId} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{agent.agentName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {agent.executionCount} executions
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black tracking-tight">
                      {agent.avgDurationMs < 1000
                        ? `${agent.avgDurationMs}ms`
                        : `${(agent.avgDurationMs / 1000).toFixed(1)}s`}
                    </div>
                    <div className="text-xs text-muted-foreground">avg. duration</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Applications */}
        <div className="border border-border">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm uppercase tracking-wide">Recent Applications</span>
            </div>
            <button
              onClick={() => setLocation("/applications")}
              className="text-xs text-primary font-semibold uppercase tracking-wide hover:underline"
            >
              View All
            </button>
          </div>
          {!recentApps || recentApps.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-muted-foreground text-sm">No applications yet.</div>
              <button
                onClick={() => setLocation("/scenarios")}
                className="mt-4 text-xs text-primary font-semibold uppercase tracking-wide hover:underline"
              >
                Run a test scenario →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentApps.map((app) => (
                <div
                  key={app.applicationId}
                  className="px-6 py-4 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/applications/${app.applicationId}`)}
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-sm font-semibold">{app.borrowerName}</div>
                      <div className="text-xs text-muted-foreground mono mt-0.5">
                        {app.applicationId}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-bold">
                        ${app.loanAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {app.loanTermMonths / 12}yr
                      </div>
                    </div>
                    {app.decision ? (
                      <span
                        className={`text-xs font-bold uppercase tracking-wide px-2 py-1 ${
                          app.decision === "approved"
                            ? "decision-approved"
                            : app.decision === "conditional_approval"
                            ? "decision-conditional"
                            : app.decision === "denied"
                            ? "decision-denied"
                            : "decision-review"
                        }`}
                      >
                        {app.decision === "conditional_approval"
                          ? "Conditional"
                          : app.decision === "review_required"
                          ? "Review"
                          : app.decision}
                      </span>
                    ) : (
                      <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 status-running">
                        {app.status}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
          <button
            onClick={() => setLocation("/apply")}
            className="bg-card p-6 text-left hover:bg-muted/40 transition-colors group"
          >
            <FileText className="h-5 w-5 text-primary mb-3" />
            <div className="font-bold text-sm">Submit Application</div>
            <div className="text-xs text-muted-foreground mt-1">
              Enter borrower details and run the full underwriting pipeline
            </div>
          </button>
          <button
            onClick={() => setLocation("/scenarios")}
            className="bg-card p-6 text-left hover:bg-muted/40 transition-colors group"
          >
            <BarChart2 className="h-5 w-5 text-primary mb-3" />
            <div className="font-bold text-sm">Test Scenarios</div>
            <div className="text-xs text-muted-foreground mt-1">
              One-click demo runs: Prime, Good, Denied, Compliance, Complex
            </div>
          </button>
          <button
            onClick={() => setLocation("/agents")}
            className="bg-card p-6 text-left hover:bg-muted/40 transition-colors group"
          >
            <Shield className="h-5 w-5 text-primary mb-3" />
            <div className="font-bold text-sm">Agent Directory</div>
            <div className="text-xs text-muted-foreground mt-1">
              OASF capability definitions for all registered AGNTCY agents
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
