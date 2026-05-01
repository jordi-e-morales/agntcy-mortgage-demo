import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Radio, CheckCircle2, Globe } from "lucide-react";

interface AgentDiscoveryFlowProps {
  applicationId: string;
}

const EVENT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  announce: {
    label: "ANNOUNCE",
    icon: <Radio className="w-3.5 h-3.5" />,
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
  },
  discover: {
    label: "DISCOVER",
    icon: <Search className="w-3.5 h-3.5" />,
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
  },
  resolve: {
    label: "RESOLVE",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
};

const AGENT_LABELS: Record<string, string> = {
  "pipeline-orchestrator-v1": "Pipeline Orchestrator",
  "application-processor-v1": "Application Processor",
  "credit-analyzer-v1": "Credit Analyzer",
  "collateral-valuator-v1": "Collateral Valuator",
  "compliance-checker-v1": "Compliance Checker",
  "risk-scorer-v1": "Risk Scorer",
  "decision-engine-v1": "Decision Engine",
  "documentation-generator-v1": "Documentation Generator",
};

export default function AgentDiscoveryFlow({ applicationId }: AgentDiscoveryFlowProps) {
  const { data: events = [], isLoading } = trpc.mortgage.getDirEvents.useQuery(
    { applicationId },
    { refetchInterval: 2000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        <Globe className="w-4 h-4 mr-2 animate-pulse" />
        Waiting for Agent Directory events…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
        <Globe className="w-8 h-8" />
        <p className="text-sm">No Agent Directory events yet. Run a pipeline to see discovery.</p>
      </div>
    );
  }

  const announces = events.filter((e) => e.eventType === "announce");
  const discovers = events.filter((e) => e.eventType === "discover");
  const resolves = events.filter((e) => e.eventType === "resolve");

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-black p-3">
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <div className="text-xs text-gray-500 uppercase tracking-widest">Announces</div>
          </div>
          <div className="text-2xl font-black text-blue-600">{announces.length}</div>
          <div className="text-[10px] text-gray-400 mt-1">Agents registered to DIR</div>
        </div>
        <div className="border border-black p-3">
          <div className="flex items-center gap-2 mb-1">
            <Search className="w-3.5 h-3.5 text-purple-600" />
            <div className="text-xs text-gray-500 uppercase tracking-widest">Discovers</div>
          </div>
          <div className="text-2xl font-black text-purple-600">{discovers.length}</div>
          <div className="text-[10px] text-gray-400 mt-1">Capability lookups</div>
        </div>
        <div className="border border-black p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <div className="text-xs text-gray-500 uppercase tracking-widest">Resolves</div>
          </div>
          <div className="text-2xl font-black text-green-600">{resolves.length}</div>
          <div className="text-[10px] text-gray-400 mt-1">DID-to-endpoint resolved</div>
        </div>
      </div>

      {/* Protocol explanation */}
      <div className="border border-black p-3 bg-gray-50 text-xs space-y-1.5">
        <div className="font-bold uppercase tracking-widest text-gray-700 mb-2">AGNTCY Agent Directory Protocol</div>
        <div className="flex gap-2">
          <span className="text-blue-600 font-bold shrink-0">ANNOUNCE</span>
          <span className="text-gray-600">Agent registers its DID, OASF capabilities, and endpoint with the Directory</span>
        </div>
        <div className="flex gap-2">
          <span className="text-purple-600 font-bold shrink-0">DISCOVER</span>
          <span className="text-gray-600">Requesting agent queries the Directory for agents with a specific capability</span>
        </div>
        <div className="flex gap-2">
          <span className="text-green-600 font-bold shrink-0">RESOLVE</span>
          <span className="text-gray-600">Directory resolves a DID to a verified endpoint, returning identity proof</span>
        </div>
      </div>

      {/* Event timeline */}
      <ScrollArea className="h-[380px] border border-black">
        <div className="divide-y divide-gray-100">
          {events.map((event, idx) => {
            const cfg = EVENT_CONFIG[event.eventType] ?? EVENT_CONFIG.announce;

            return (
              <div key={event.id} className="p-3 hover:bg-gray-50 transition-colors">
                {/* Row 1: index + event type + agent */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-gray-400 font-mono w-5 shrink-0">{idx + 1}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold flex items-center gap-1 ${cfg.color} ${cfg.bg}`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </Badge>
                  <span className="text-xs font-medium">
                    {AGENT_LABELS[event.agentId] ?? event.agentId}
                  </span>
                  <div className="flex-1" />
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                {/* Row 2: DID */}
                <div className="ml-7 text-[10px] font-mono text-gray-500 truncate">
                  <span className="text-gray-400">did: </span>
                  <span className="text-gray-700">{event.agentDid}</span>
                </div>

                {/* Row 3: event-specific details */}
                {event.eventType === "discover" && event.queryCapability && (
                  <div className="ml-7 mt-1 text-[10px] space-y-0.5">
                    <div className="flex gap-2">
                      <span className="text-gray-400">capability:</span>
                      <span className="font-mono text-purple-700 font-bold">{event.queryCapability}</span>
                    </div>
                    {event.queryDomain && (
                      <div className="flex gap-2">
                        <span className="text-gray-400">domain:</span>
                        <span className="font-mono text-gray-700">{event.queryDomain}</span>
                      </div>
                    )}
                    {event.resultCount != null && (
                      <div className="flex gap-2">
                        <span className="text-gray-400">matches:</span>
                        <span className="font-mono text-green-700 font-bold">{event.resultCount} agent(s) found</span>
                      </div>
                    )}
                  </div>
                )}

                {event.eventType === "announce" && event.oasfRecord != null && (
                  <div className="ml-7 mt-1 text-[10px]">
                    <span className="text-gray-400">oasf_record: </span>
                    <span className="font-mono text-blue-700">registered</span>
                    {event.latencyMs != null && (
                      <span className="text-gray-400 ml-2">{event.latencyMs}ms</span>
                    )}
                  </div>
                )}

                {event.eventType === "resolve" && (
                  <div className="ml-7 mt-1 text-[10px] space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">identity:</span>
                      <span className={`font-bold ${event.success ? "text-green-700" : "text-red-700"}`}>
                        {event.success ? "✓ Verified" : "✗ Failed"}
                      </span>
                    </div>
                    {event.latencyMs != null && (
                      <div className="flex gap-2">
                        <span className="text-gray-400">resolved in:</span>
                        <span className="font-mono text-gray-700">{event.latencyMs}ms</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="text-[10px] text-gray-400 font-mono border-t border-gray-100 pt-2">
        Registry: <span className="text-gray-600">AGNTCY Agent Directory (dir-spec)</span>
        {" · "}
        Identity: <span className="text-gray-600">Decentralized Identifiers (DID)</span>
        {" · "}
        Schema: <span className="text-gray-600">OASF (Open Agent Schema Framework)</span>
      </div>
    </div>
  );
}
