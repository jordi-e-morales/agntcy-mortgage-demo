import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle, Circle, Loader2 } from "lucide-react";

interface AgentDef {
  id: string;
  name: string;
  version: string;
  description: string;
  status: string;
  capabilities: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  oasfMetadata: Record<string, unknown>;
}

function AgentCard({ agent }: { agent: AgentDef }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border bg-card">
      <div
        className="px-6 py-5 flex items-start justify-between cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start gap-4">
          {/* Status indicator */}
          <div className="mt-1">
            {agent.status === "active" ? (
              <CheckCircle className="h-4 w-4 text-[oklch(0.55_0.15_145)]" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-base font-black tracking-[-0.03em]">{agent.name}</h3>
              <span className="text-xs mono text-muted-foreground">v{agent.version}</span>
              <span
                className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 ${
                  agent.status === "active" ? "decision-approved" : "status-pending"
                }`}
              >
                {agent.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{agent.description}</p>
            {/* Capabilities */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {agent.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="text-xs px-2 py-0.5 bg-muted border border-border font-medium"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <span className="text-xs mono text-muted-foreground">{agent.id}</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {/* OASF Metadata */}
          <div className="px-6 py-4 border-b border-border">
            <div className="label-caps mb-3">OASF Metadata</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(agent.oasfMetadata ?? {}).map(([key, value]) => (
                <div key={key}>
                  <div className="label-caps mb-1">{key}</div>
                  <div className="text-xs font-semibold">{String(value)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Schemas */}
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="px-6 py-4">
              <div className="label-caps mb-2">Input Schema</div>
              <pre className="text-xs mono text-muted-foreground overflow-auto max-h-64 whitespace-pre-wrap">
                {JSON.stringify(agent.inputSchema, null, 2)}
              </pre>
            </div>
            <div className="px-6 py-4">
              <div className="label-caps mb-2">Output Schema</div>
              <pre className="text-xs mono text-muted-foreground overflow-auto max-h-64 whitespace-pre-wrap">
                {JSON.stringify(agent.outputSchema, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentDirectory() {
  const { data: agents, isLoading } = trpc.mortgage.getAgentDirectory.useQuery();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-4 h-4 bg-primary flex-shrink-0" />
          <span className="label-caps">Agent Directory</span>
        </div>
        <h1 className="text-3xl font-black tracking-[-0.04em]">AGNTCY Agent Registry</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          All agents registered in the AGNTCY Agent Directory with their OASF capability definitions, input/output schemas, and active status.
        </p>
      </div>

      <div className="px-8 py-8">
        {/* AGNTCY Framework Info */}
        <div className="grid grid-cols-3 gap-px bg-border mb-8">
          <div className="bg-card px-6 py-5">
            <div className="label-caps mb-2">Framework</div>
            <div className="text-2xl font-black tracking-[-0.04em]">AGNTCY</div>
            <div className="text-xs text-muted-foreground mt-1">Internet of Agents</div>
          </div>
          <div className="bg-card px-6 py-5">
            <div className="label-caps mb-2">Standard</div>
            <div className="text-2xl font-black tracking-[-0.04em]">OASF</div>
            <div className="text-xs text-muted-foreground mt-1">Open Agent Schema Framework</div>
          </div>
          <div className="bg-primary px-6 py-5">
            <div className="label-caps mb-2 text-primary-foreground/70">Registered Agents</div>
            <div className="text-2xl font-black tracking-[-0.04em] text-primary-foreground">
              {isLoading ? "…" : agents?.length ?? 0}
            </div>
            <div className="text-xs text-primary-foreground/70 mt-1">All active</div>
          </div>
        </div>

        {/* Pipeline Diagram */}
        <div className="border border-border p-5 mb-8">
          <div className="label-caps mb-3">Orchestration Topology</div>
          <div className="flex items-center gap-1 flex-wrap text-xs">
            <div className="border border-border px-3 py-2 font-bold bg-primary text-primary-foreground">
              Application Processor
            </div>
            <div className="text-muted-foreground px-1">→</div>
            <div className="flex items-center gap-1">
              <div className="border border-border px-3 py-2 font-semibold">Credit Analyzer</div>
              <div className="border border-border px-3 py-2 font-semibold">Collateral Valuator</div>
              <div className="border border-border px-3 py-2 font-semibold">Compliance Checker</div>
            </div>
            <div className="text-muted-foreground px-1">→</div>
            <div className="border border-border px-3 py-2 font-semibold">Risk Scorer</div>
            <div className="text-muted-foreground px-1">→</div>
            <div className="border border-border px-3 py-2 font-semibold">Decision Engine</div>
            <div className="text-muted-foreground px-1">→</div>
            <div className="border border-border px-3 py-2 font-semibold">Documentation Generator</div>
          </div>
          <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-primary" />
              <span>Entry Point</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border-2 border-border" />
              <span>Sequential</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                <div className="w-2 h-3 border border-border" />
                <div className="w-2 h-3 border border-border" />
                <div className="w-2 h-3 border border-border" />
              </div>
              <span>Parallel</span>
            </div>
          </div>
        </div>

        {/* Agent Cards */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading agent registry…
          </div>
        ) : (
          <div className="space-y-px bg-border">
            {agents?.map((agent) => (
              <AgentCard key={agent.id} agent={agent as unknown as AgentDef} />
            ))}
          </div>
        )}

        {/* AGNTCY Principles */}
        <div className="mt-8 border border-border">
          <div className="px-6 py-4 border-b border-border">
            <span className="font-bold text-sm uppercase tracking-wide">AGNTCY Framework Capabilities</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
            {[
              { label: "Discover", desc: "Agent Directory with OASF schemas for capability-based discovery" },
              { label: "Compose", desc: "LangGraph orchestration connecting agents into typed workflows" },
              { label: "Deploy", desc: "Secure execution with identity management and access control" },
              { label: "Evaluate", desc: "Full observability: audit trails, performance metrics, decision logs" },
            ].map((item) => (
              <div key={item.label} className="px-5 py-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-primary flex-shrink-0" />
                  <span className="font-black text-sm uppercase tracking-[-0.02em]">{item.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
