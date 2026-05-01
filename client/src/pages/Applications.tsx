import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ChevronRight, FileText } from "lucide-react";

export default function Applications() {
  const { data: apps, isLoading } = trpc.mortgage.listApplications.useQuery({ limit: 50 });
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-primary flex-shrink-0" />
          <span className="label-caps">Applications</span>
        </div>
        <h1 className="text-3xl font-black tracking-[-0.04em]">All Applications</h1>
      </div>

      <div className="px-8 py-8">
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : !apps || apps.length === 0 ? (
          <div className="border border-border px-8 py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
            <div className="text-muted-foreground text-sm mb-4">No applications yet.</div>
            <button
              onClick={() => setLocation("/scenarios")}
              className="text-xs text-primary font-bold uppercase tracking-wide hover:underline"
            >
              Run a test scenario →
            </button>
          </div>
        ) : (
          <div className="border border-border">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-border bg-muted/40">
              <div className="label-caps">Borrower / Application ID</div>
              <div className="label-caps">Loan Amount</div>
              <div className="label-caps">Term</div>
              <div className="label-caps">Credit Score</div>
              <div className="label-caps">Decision</div>
              <div className="label-caps">Rate</div>
            </div>
            <div className="divide-y divide-border">
              {apps.map((app) => (
                <div
                  key={app.applicationId}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-6 py-4 items-center hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setLocation(`/applications/${app.applicationId}`)}
                >
                  <div>
                    <div className="text-sm font-semibold">{app.borrowerName}</div>
                    <div className="text-xs mono text-muted-foreground mt-0.5">{app.applicationId}</div>
                    {app.scenarioType && (
                      <div className="text-xs text-primary font-semibold mt-0.5 uppercase tracking-wide">
                        {app.scenarioType.replace(/-/g, " ")}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-bold text-right">${app.loanAmount.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground text-right">{app.loanTermMonths / 12}yr</div>
                  <div className="text-sm font-bold text-right">{app.creditScore ?? "—"}</div>
                  <div>
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
                      <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 status-${app.status}`}>
                        {app.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-right">
                      {app.interestRate ? `${app.interestRate.toFixed(2)}%` : "—"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
