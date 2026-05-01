import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { PlayCircle, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

const DECISION_COLORS: Record<string, string> = {
  approved: "decision-approved",
  conditional_approval: "decision-conditional",
  denied: "decision-denied",
  review_required: "decision-review",
};

const SCENARIO_DESCRIPTIONS: Record<string, { detail: string; creditScore: string; dti: string; ltv: string }> = {
  "prime-borrower": {
    detail: "High credit score (780), stable 8-year employment, low DTI (28%), strong 20% down payment. Showcases the happy path through the full pipeline.",
    creditScore: "780",
    dti: "~28%",
    ltv: "80%",
  },
  "good-borrower": {
    detail: "Good credit (718), moderate DTI (38%), smaller down payment (10%). Triggers conditional approval with standard documentation requirements.",
    creditScore: "718",
    dti: "~38%",
    ltv: "90%",
  },
  denied: {
    detail: "Poor credit (598), very high DTI (>50%), minimal down payment (3%). Multiple risk threshold violations trigger automatic denial.",
    creditScore: "598",
    dti: ">50%",
    ltv: "97%",
  },
  "compliance-trigger": {
    detail: "Self-employed borrower with international business income. Triggers BSA/AML review and Fair Lending analysis. Demonstrates compliance escalation.",
    creditScore: "705",
    dti: "~35%",
    ltv: "75%",
  },
  "complex-application": {
    detail: "Co-borrower scenario, self-employed with multiple income sources, coastal property. Requires multi-step review and additional documentation.",
    creditScore: "742",
    dti: "~40%",
    ltv: "80%",
  },
};

export default function Scenarios() {
  const { data: scenarios, isLoading } = trpc.mortgage.getTestScenarios.useQuery();
  const [, setLocation] = useLocation();
  const [runningId, setRunningId] = useState<string | null>(null);

  const runScenario = trpc.mortgage.runScenario.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.scenarioName} — pipeline started`);
      setLocation(`/applications/${data.applicationId}`);
    },
    onError: (err) => {
      toast.error(err.message);
      setRunningId(null);
    },
  });

  const handleRun = (scenarioId: string) => {
    setRunningId(scenarioId);
    runScenario.mutate({ scenarioId });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-primary flex-shrink-0" />
          <span className="label-caps">Test Scenarios</span>
        </div>
        <h1 className="text-3xl font-black tracking-[-0.04em]">Pre-Built Demo Scenarios</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Launch any of the five pre-configured mortgage applications with a single click. Each scenario exercises a distinct path through the AGNTCY underwriting pipeline.
        </p>
      </div>

      <div className="px-8 py-8">
        {/* Pipeline Architecture Note */}
        <div className="border border-border p-5 mb-8 bg-muted/20">
          <div className="label-caps mb-2">Pipeline Architecture</div>
          <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
            {[
              "Application Processor",
              "→",
              "Credit Analyzer",
              "+",
              "Collateral Valuator",
              "+",
              "Compliance Checker",
              "→",
              "Risk Scorer",
              "→",
              "Decision Engine",
              "→",
              "Documentation Generator",
            ].map((item, i) => (
              <span
                key={i}
                className={
                  item === "→" || item === "+"
                    ? "text-muted-foreground"
                    : "px-2 py-0.5 bg-background border border-border"
                }
              >
                {item}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Credit Analyzer, Collateral Valuator, and Compliance Checker execute in parallel. All agent steps return structured JSON responses.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading scenarios…
          </div>
        ) : (
          <div className="space-y-px bg-border">
            {scenarios?.map((scenario) => {
              const meta = SCENARIO_DESCRIPTIONS[scenario.id];
              const isRunning = runningId === scenario.id;

              return (
                <div key={scenario.id} className="bg-card">
                  <div className="px-6 py-6 flex items-start justify-between gap-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-black tracking-[-0.03em]">{scenario.name}</h3>
                        <span
                          className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 ${
                            DECISION_COLORS[scenario.expectedDecision] ?? "status-pending"
                          }`}
                        >
                          Expected: {scenario.badge}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{scenario.description}</p>
                      {meta && (
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="label-caps">Credit Score</span>
                            <div className="text-sm font-bold mt-0.5">{meta.creditScore}</div>
                          </div>
                          <div className="w-px h-8 bg-border" />
                          <div>
                            <span className="label-caps">Est. DTI</span>
                            <div className="text-sm font-bold mt-0.5">{meta.dti}</div>
                          </div>
                          <div className="w-px h-8 bg-border" />
                          <div>
                            <span className="label-caps">Est. LTV</span>
                            <div className="text-sm font-bold mt-0.5">{meta.ltv}</div>
                          </div>
                        </div>
                      )}
                      {meta?.detail && (
                        <p className="text-xs text-muted-foreground mt-3 max-w-lg">{meta.detail}</p>
                      )}
                    </div>

                    <button
                      onClick={() => handleRun(scenario.id)}
                      disabled={isRunning || runScenario.isPending}
                      className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-primary/90 disabled:opacity-60 transition-colors flex-shrink-0"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Running…
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4" />
                          Run Scenario
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info */}
        <div className="mt-8 border-t border-border pt-6">
          <div className="label-caps mb-2">About Test Scenarios</div>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Each scenario uses realistic borrower profiles with pre-configured credit scores, income levels, property values, and loan parameters. The AGNTCY pipeline processes each application through all seven agents using LLM-powered analysis, producing fully explainable decisions with complete audit trails. Results may vary slightly between runs due to LLM inference.
          </p>
        </div>
      </div>
    </div>
  );
}
