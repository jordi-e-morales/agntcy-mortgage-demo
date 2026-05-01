import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import {
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentEvent {
  id: number;
  agentId: string;
  agentName: string;
  status: "pending" | "running" | "completed" | "failed";
  inputData: unknown;
  outputData: unknown;
  durationMs: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

// ─── Agent Pipeline Config ────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    id: "application-processor-v1",
    name: "Application Processor",
    description: "Validates & normalises application data",
    stage: 0,
    parallel: false,
  },
  {
    id: "credit-analyzer-v1",
    name: "Credit Analyzer",
    description: "Credit score, DTI, risk assessment",
    stage: 1,
    parallel: true,
  },
  {
    id: "collateral-valuator-v1",
    name: "Collateral Valuator",
    description: "Property valuation, LTV calculation",
    stage: 1,
    parallel: true,
  },
  {
    id: "compliance-checker-v1",
    name: "Compliance Checker",
    description: "Fair Lending, BSA/AML, regulatory limits",
    stage: 1,
    parallel: true,
  },
  {
    id: "risk-scorer-v1",
    name: "Risk Scorer",
    description: "Composite risk score & rate pricing",
    stage: 2,
    parallel: false,
  },
  {
    id: "decision-engine-v1",
    name: "Decision Engine",
    description: "Final underwriting decision",
    stage: 3,
    parallel: false,
  },
  {
    id: "documentation-generator-v1",
    name: "Documentation Generator",
    description: "Loan documents & disclosures",
    stage: 4,
    parallel: false,
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle className="h-4 w-4 text-[oklch(0.55_0.15_145)]" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-primary" />;
  if (status === "running") return <Loader2 className="h-4 w-4 text-[oklch(0.55_0.15_250)] animate-spin" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

function AgentCard({ agent, event }: { agent: typeof PIPELINE_STAGES[0]; event?: AgentEvent }) {
  const [expanded, setExpanded] = useState(false);
  const status = event?.status ?? "pending";

  return (
    <div
      className={`border transition-all ${
        status === "running"
          ? "border-[oklch(0.65_0.15_250)] bg-[oklch(0.97_0.02_250)]"
          : status === "completed"
          ? "border-[oklch(0.80_0.06_145)] bg-[oklch(0.98_0.02_145)]"
          : status === "failed"
          ? "border-primary bg-[oklch(0.98_0.02_27)]"
          : "border-border bg-card"
      }`}
    >
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => event && setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-3">
          <StatusIcon status={status} />
          <div>
            <div className="text-sm font-bold">{agent.name}</div>
            <div className="text-xs text-muted-foreground">{agent.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {event?.durationMs && (
            <span className="text-xs text-muted-foreground mono">
              {event.durationMs < 1000
                ? `${event.durationMs}ms`
                : `${(event.durationMs / 1000).toFixed(1)}s`}
            </span>
          )}
          <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 status-${status}`}>
            {status}
          </span>
          {event && (expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />)}
        </div>
      </div>

      {expanded && event && (
        <div className="border-t border-border">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="p-4">
              <div className="label-caps mb-2">Input</div>
              <pre className="text-xs mono text-muted-foreground overflow-auto max-h-48 whitespace-pre-wrap">
                {JSON.stringify(event.inputData, null, 2)}
              </pre>
            </div>
            <div className="p-4">
              <div className="label-caps mb-2">Output</div>
              <pre className="text-xs mono text-muted-foreground overflow-auto max-h-48 whitespace-pre-wrap">
                {JSON.stringify(event.outputData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DecisionPanel({ app }: { app: Record<string, unknown> }) {
  const decisionResult = app.decisionEngineResult as Record<string, unknown> | null;
  const riskResult = app.riskScorerResult as Record<string, unknown> | null;
  const decision = app.decision as string | null;

  if (!decision || !decisionResult) return null;

  const decisionClass =
    decision === "approved"
      ? "decision-approved"
      : decision === "conditional_approval"
      ? "decision-conditional"
      : decision === "denied"
      ? "decision-denied"
      : "decision-review";

  const decisionLabel =
    decision === "approved"
      ? "Approved"
      : decision === "conditional_approval"
      ? "Conditional Approval"
      : decision === "denied"
      ? "Denied"
      : "Review Required";

  return (
    <div className="border border-border">
      {/* Decision Header */}
      <div className={`px-6 py-5 ${decisionClass}`}>
        <div className="label-caps mb-1" style={{ color: "inherit", opacity: 0.7 }}>
          Underwriting Decision
        </div>
        <div className="text-2xl font-black tracking-[-0.04em]">{decisionLabel}</div>
        {(decisionResult.decisionCode as string) && (
          <div className="text-xs mono mt-1 opacity-70">{decisionResult.decisionCode as string}</div>
        )}
      </div>

      {/* Loan Terms */}
      {decision !== "denied" && riskResult && (
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
          <div className="px-5 py-4">
            <div className="label-caps mb-1">Interest Rate</div>
            <div className="text-2xl font-black">{(riskResult.finalRate as number)?.toFixed(2)}%</div>
            <div className="text-xs text-muted-foreground">{riskResult.riskTier as string}</div>
          </div>
          <div className="px-5 py-4">
            <div className="label-caps mb-1">Monthly Payment</div>
            <div className="text-2xl font-black">
              ${(riskResult.monthlyPayment as number)?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground">Principal + Interest</div>
          </div>
          <div className="px-5 py-4">
            <div className="label-caps mb-1">Risk Score</div>
            <div className="text-2xl font-black">{riskResult.riskScore as number}</div>
            <div className="text-xs text-muted-foreground">/ 100</div>
          </div>
        </div>
      )}

      {/* Rationale */}
      <div className="px-6 py-5 border-b border-border">
        <div className="label-caps mb-2">Decision Rationale</div>
        <p className="text-sm text-foreground leading-relaxed">{decisionResult.rationale as string}</p>
      </div>

      {/* Key Factors */}
      {Array.isArray(decisionResult.keyFactors) && decisionResult.keyFactors.length > 0 && (
        <div className="px-6 py-5 border-b border-border">
          <div className="label-caps mb-3">Key Decision Factors</div>
          <div className="space-y-2">
            {(decisionResult.keyFactors as Array<{ factor: string; assessment: string; impact: string }>).map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className={`w-2 h-2 mt-1.5 flex-shrink-0 ${
                    f.impact === "Positive"
                      ? "bg-[oklch(0.55_0.15_145)]"
                      : f.impact === "Negative"
                      ? "bg-primary"
                      : "bg-muted-foreground"
                  }`}
                />
                <div>
                  <span className="text-sm font-semibold">{f.factor}: </span>
                  <span className="text-sm text-muted-foreground">{f.assessment}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conditions */}
      {Array.isArray(decisionResult.conditions) && decisionResult.conditions.length > 0 && (
        <div className="px-6 py-5 border-b border-border">
          <div className="label-caps mb-3">Conditions</div>
          <div className="space-y-1.5">
            {(decisionResult.conditions as string[]).map((c, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-[oklch(0.55_0.12_80)] mt-0.5 flex-shrink-0" />
                <span className="text-sm">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {Array.isArray(decisionResult.nextSteps) && decisionResult.nextSteps.length > 0 && (
        <div className="px-6 py-5">
          <div className="label-caps mb-3">Next Steps</div>
          <div className="space-y-1.5">
            {(decisionResult.nextSteps as string[]).map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompliancePanel({ app }: { app: Record<string, unknown> }) {
  const compliance = app.complianceCheckerResult as Record<string, unknown> | null;
  if (!compliance) return null;

  const fairLending = compliance.fairLendingAssessment as Record<string, unknown> | null;

  return (
    <div className="border border-border">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <span className="font-bold text-sm uppercase tracking-wide">Compliance Report</span>
        <span
          className={`text-xs font-bold uppercase tracking-wide px-2 py-1 ${
            compliance.complianceStatus === "compliant"
              ? "decision-approved"
              : compliance.complianceStatus === "review_required"
              ? "decision-review"
              : "decision-denied"
          }`}
        >
          {(compliance.complianceStatus as string)?.replace("_", " ")}
        </span>
      </div>

      <div className="divide-y divide-border">
        {/* Fair Lending */}
        <div className="px-6 py-4">
          <div className="label-caps mb-2">Fair Lending (ECOA / FHA)</div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 ${
                fairLending?.status === "Pass" ? "decision-approved" : fairLending?.status === "Review" ? "decision-review" : "decision-denied"
              }`}
            >
              {fairLending?.status as string}
            </span>
          </div>
          {Array.isArray(fairLending?.findings) && (fairLending!.findings as string[]).map((f, i) => (
            <div key={i} className="text-xs text-muted-foreground mt-1">• {f}</div>
          ))}
        </div>

        {/* BSA/AML */}
        <div className="px-6 py-4">
          <div className="label-caps mb-2">BSA / AML Screening</div>
          <span
            className={`text-xs font-bold px-2 py-0.5 ${
              compliance.bsaAmlResult === "Clear" ? "decision-approved" : compliance.bsaAmlResult === "Review" ? "decision-review" : "decision-denied"
            }`}
          >
            {compliance.bsaAmlResult as string}
          </span>
          {Array.isArray(compliance.bsaAmlFindings) && (compliance.bsaAmlFindings as string[]).map((f, i) => (
            <div key={i} className="text-xs text-muted-foreground mt-1">• {f}</div>
          ))}
        </div>

        {/* Regulatory Checks */}
        {Array.isArray(compliance.regulatoryChecks) && (
          <div className="px-6 py-4">
            <div className="label-caps mb-3">Regulatory Limit Checks</div>
            <div className="space-y-2">
              {(compliance.regulatoryChecks as Array<{ rule: string; value: string; threshold: string; passed: boolean }>).map((check, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{check.rule}</span>
                  <div className="flex items-center gap-3">
                    <span className="mono text-xs text-muted-foreground">{check.value} / {check.threshold}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 ${check.passed ? "decision-approved" : "decision-denied"}`}>
                      {check.passed ? "Pass" : "Fail"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Required Disclosures */}
        {Array.isArray(compliance.requiredDisclosures) && (compliance.requiredDisclosures as string[]).length > 0 && (
          <div className="px-6 py-4">
            <div className="label-caps mb-2">Required Disclosures</div>
            {(compliance.requiredDisclosures as string[]).map((d, i) => (
              <div key={i} className="text-xs text-muted-foreground mt-1">• {d}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AuditTrailPanel({ applicationId }: { applicationId: string }) {
  const { data: trail } = trpc.mortgage.getAuditTrail.useQuery({ applicationId });

  if (!trail || trail.length === 0) {
    return (
      <div className="border border-border px-6 py-8 text-center text-muted-foreground text-sm">
        No audit events yet.
      </div>
    );
  }

  return (
    <div className="border border-border">
      <div className="px-6 py-4 border-b border-border">
        <span className="font-bold text-sm uppercase tracking-wide">Audit Trail</span>
        <span className="ml-3 text-xs text-muted-foreground">{trail.length} events</span>
      </div>
      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {trail.map((entry) => (
          <div key={entry.id} className="px-6 py-3 flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  entry.severity === "error" || entry.severity === "critical"
                    ? "bg-primary"
                    : entry.severity === "warning"
                    ? "bg-[oklch(0.65_0.12_80)]"
                    : "bg-[oklch(0.55_0.15_145)]"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide mono">{entry.eventType}</span>
                {entry.agentName && (
                  <span className="text-xs text-muted-foreground">— {entry.agentName}</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{entry.description}</div>
            </div>
            <div className="text-xs mono text-muted-foreground flex-shrink-0">
              {new Date(entry.createdAt).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApplicationDetail() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"pipeline" | "decision" | "compliance" | "audit">("pipeline");

  const { data, isLoading, refetch } = trpc.mortgage.getApplication.useQuery(
    { applicationId },
    { refetchInterval: (data) => {
        const status = data?.state?.data?.application?.status;
        return status === "processing" || status === "pending" ? 2000 : false;
      }
    }
  );

  const app = data?.application;
  const agentEvents: AgentEvent[] = (data?.agentEvents ?? []) as AgentEvent[];

  const getEventForAgent = (agentId: string) =>
    agentEvents.find((e) => e.agentId === agentId);

  const completedCount = agentEvents.filter((e) => e.status === "completed").length;
  const totalAgents = PIPELINE_STAGES.length;
  const progress = Math.round((completedCount / totalAgents) * 100);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="px-8 py-8">
        <div className="text-muted-foreground">Application not found.</div>
      </div>
    );
  }

  const TABS = [
    { id: "pipeline", label: "Pipeline" },
    { id: "decision", label: "Decision" },
    { id: "compliance", label: "Compliance" },
    { id: "audit", label: "Audit Trail" },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <button
          onClick={() => setLocation("/applications")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 uppercase tracking-wide font-semibold"
        >
          <ChevronLeft className="h-3 w-3" />
          Applications
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-4 h-4 bg-primary flex-shrink-0" />
              <span className="label-caps mono">{applicationId}</span>
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em]">{app.borrowerName}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-muted-foreground">
                ${app.loanAmount.toLocaleString()} · {app.loanTermMonths / 12}yr {app.loanPurpose}
              </span>
              {app.propertyAddress && (
                <span className="text-sm text-muted-foreground">{app.propertyAddress}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {app.decision ? (
              <span
                className={`text-sm font-bold uppercase tracking-wide px-3 py-1.5 ${
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
                  ? "Conditional Approval"
                  : app.decision === "review_required"
                  ? "Review Required"
                  : app.decision}
              </span>
            ) : (
              <span className="text-sm font-bold uppercase tracking-wide px-3 py-1.5 status-running">
                {app.status}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {app.status === "processing" && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="label-caps">Pipeline Progress</span>
              <span className="text-xs mono text-muted-foreground">{completedCount}/{totalAgents} agents</span>
            </div>
            <div className="h-1.5 bg-muted w-full">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-8">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-8">
        {/* Pipeline Tab */}
        {activeTab === "pipeline" && (
          <div className="max-w-2xl space-y-2">
            <div className="label-caps mb-4">Multi-Agent Orchestration Pipeline</div>

            {/* Stage 0 */}
            <AgentCard
              agent={PIPELINE_STAGES[0]}
              event={getEventForAgent(PIPELINE_STAGES[0].id)}
            />

            {/* Parallel connector */}
            <div className="flex items-center gap-2 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="label-caps">Parallel Execution</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Stage 1: Parallel */}
            <div className="grid grid-cols-1 gap-2">
              {PIPELINE_STAGES.filter((s) => s.stage === 1).map((agent) => (
                <AgentCard key={agent.id} agent={agent} event={getEventForAgent(agent.id)} />
              ))}
            </div>

            {/* Sequential stages */}
            {[2, 3, 4].map((stageNum) => {
              const stageAgent = PIPELINE_STAGES.find((s) => s.stage === stageNum);
              if (!stageAgent) return null;
              return (
                <div key={stageNum}>
                  <div className="flex justify-center py-1">
                    <div className="h-4 w-px bg-border" />
                  </div>
                  <AgentCard agent={stageAgent} event={getEventForAgent(stageAgent.id)} />
                </div>
              );
            })}
          </div>
        )}

        {/* Decision Tab */}
        {activeTab === "decision" && (
          <div className="max-w-2xl">
            {app.status !== "completed" ? (
              <div className="border border-border px-6 py-8 text-center text-muted-foreground text-sm">
                {app.status === "processing" ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Pipeline is running — decision will appear here when complete.</span>
                  </div>
                ) : (
                  "No decision available yet."
                )}
              </div>
            ) : (
              <DecisionPanel app={app as unknown as Record<string, unknown>} />
            )}
          </div>
        )}

        {/* Compliance Tab */}
        {activeTab === "compliance" && (
          <div className="max-w-2xl">
            {!app.complianceCheckerResult ? (
              <div className="border border-border px-6 py-8 text-center text-muted-foreground text-sm">
                {app.status === "processing" ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span>Compliance check in progress…</span>
                  </div>
                ) : (
                  "No compliance data available."
                )}
              </div>
            ) : (
              <CompliancePanel app={app as unknown as Record<string, unknown>} />
            )}
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === "audit" && (
          <div className="max-w-2xl">
            <AuditTrailPanel applicationId={applicationId} />
          </div>
        )}
      </div>
    </div>
  );
}
