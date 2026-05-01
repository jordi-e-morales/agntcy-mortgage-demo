import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Lock, CheckCircle2, ArrowRight, Zap, Radio } from "lucide-react";

interface SlimMessageBusProps {
  applicationId: string;
}

const PATTERN_COLORS: Record<string, string> = {
  "request-reply": "bg-blue-100 text-blue-800 border-blue-200",
  "pub-sub": "bg-purple-100 text-purple-800 border-purple-200",
  "fire-and-forget": "bg-orange-100 text-orange-800 border-orange-200",
  streaming: "bg-green-100 text-green-800 border-green-200",
};

const AGENT_SHORT: Record<string, string> = {
  "pipeline-orchestrator-v1": "ORCH",
  "application-processor-v1": "APP",
  "credit-analyzer-v1": "CRED",
  "collateral-valuator-v1": "COLL",
  "compliance-checker-v1": "COMP",
  "risk-scorer-v1": "RISK",
  "decision-engine-v1": "DCSN",
  "documentation-generator-v1": "DOCS",
};

const AGENT_COLOR: Record<string, string> = {
  "pipeline-orchestrator-v1": "bg-gray-900 text-white",
  "application-processor-v1": "bg-blue-600 text-white",
  "credit-analyzer-v1": "bg-indigo-600 text-white",
  "collateral-valuator-v1": "bg-violet-600 text-white",
  "compliance-checker-v1": "bg-amber-600 text-white",
  "risk-scorer-v1": "bg-orange-600 text-white",
  "decision-engine-v1": "bg-red-600 text-white",
  "documentation-generator-v1": "bg-emerald-600 text-white",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function AgentBadge({ agentId }: { agentId: string }) {
  const label = AGENT_SHORT[agentId] ?? agentId.slice(0, 4).toUpperCase();
  const color = AGENT_COLOR[agentId] ?? "bg-gray-600 text-white";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${color}`}>
      {label}
    </span>
  );
}

export default function SlimMessageBus({ applicationId }: SlimMessageBusProps) {
  const { data: messages = [], isLoading } = trpc.mortgage.getSlimMessages.useQuery(
    { applicationId },
    { refetchInterval: 2000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        <Radio className="w-4 h-4 mr-2 animate-pulse" />
        Waiting for SLIM messages…
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
        <Radio className="w-8 h-8" />
        <p className="text-sm">No SLIM messages yet. Run a pipeline to see inter-agent communication.</p>
      </div>
    );
  }

  // Group by direction: requests vs replies
  const requests = messages.filter((m) => !m.payloadSchema.includes("-response"));
  const replies = messages.filter((m) => m.payloadSchema.includes("-response"));

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="border border-black p-3">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Total Messages</div>
          <div className="text-2xl font-black">{messages.length}</div>
        </div>
        <div className="border border-black p-3">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Requests</div>
          <div className="text-2xl font-black text-blue-600">{requests.length}</div>
        </div>
        <div className="border border-black p-3">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Replies</div>
          <div className="text-2xl font-black text-green-600">{replies.length}</div>
        </div>
        <div className="border border-black p-3">
          <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">Avg Latency</div>
          <div className="text-2xl font-black">
            {messages.length > 0
              ? `${Math.round(messages.reduce((s, m) => s + (m.latencyMs ?? 0), 0) / messages.length)}ms`
              : "—"}
          </div>
        </div>
      </div>

      {/* Session & Correlation IDs */}
      {messages[0] && (
        <div className="border border-black p-3 bg-gray-50 font-mono text-xs space-y-1">
          <div className="flex gap-4">
            <span className="text-gray-500 uppercase tracking-widest">Session</span>
            <span className="font-bold">{messages[0].sessionId}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-500 uppercase tracking-widest">Correlation</span>
            <span className="font-bold">{messages[0].correlationId ?? applicationId}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-gray-500 uppercase tracking-widest">Encryption</span>
            <span className="font-bold text-green-700">{messages[0].encryptionAlgo} (MLS)</span>
          </div>
        </div>
      )}

      {/* Message list */}
      <ScrollArea className="h-[420px] border border-black">
        <div className="divide-y divide-gray-100">
          {messages.map((msg, idx) => {
            const isReply = msg.payloadSchema.includes("-response");
            return (
              <div key={msg.id} className={`p-3 hover:bg-gray-50 transition-colors ${isReply ? "bg-green-50/30" : ""}`}>
                {/* Row 1: index + routing */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-gray-400 font-mono w-5 shrink-0">{idx + 1}</span>
                  <AgentBadge agentId={msg.sourceAgentId} />
                  <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                  <AgentBadge agentId={msg.destinationAgentId} />
                  <div className="flex-1" />
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${PATTERN_COLORS[msg.pattern] ?? "bg-gray-100 text-gray-700"}`}>
                    {msg.pattern}
                  </span>
                  {isReply ? (
                    <Badge variant="outline" className="text-[10px] border-green-500 text-green-700">REPLY</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-700">REQUEST</Badge>
                  )}
                </div>

                {/* Row 2: schema + security + size + latency */}
                <div className="flex items-center gap-3 ml-7 text-[11px] text-gray-500 flex-wrap">
                  <span className="font-mono text-gray-700 font-medium">{msg.payloadSchema}</span>
                  <span className="text-gray-300">|</span>
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-green-600" />
                    <span className="text-green-700">Encrypted</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-blue-600" />
                    <span className="text-blue-700">Identity Verified</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-purple-600" />
                    <span className="text-purple-700">Sig Valid</span>
                  </span>
                  <span className="text-gray-300">|</span>
                  <span>{formatBytes(msg.payloadSizeBytes ?? 0)}</span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    {msg.latencyMs}ms
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="font-mono text-[10px] text-gray-400">{msg.messageId}</span>
                </div>

                {/* Row 3: DID routing */}
                <div className="ml-7 mt-1.5 text-[10px] font-mono text-gray-400 truncate">
                  <span className="text-gray-300">src: </span>{msg.sourceAgentDid}
                  <span className="mx-2 text-gray-300">→</span>
                  <span className="text-gray-300">dst: </span>{msg.destinationAgentDid}
                </div>

                {/* Row 4: payload preview */}
                {msg.payloadPreview && (
                  <div className="ml-7 mt-1.5 text-[10px] font-mono bg-gray-100 rounded px-2 py-1 text-gray-600 truncate">
                    {msg.payloadPreview}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Channel legend */}
      <div className="text-[10px] text-gray-400 font-mono border-t border-gray-100 pt-2">
        Channel: <span className="text-gray-600">did:agntcy:mortgage-demo/pipeline/&lt;stage&gt;</span>
        {" · "}
        Protocol: <span className="text-gray-600">SLIM (Secure Low-Latency Interactive Messaging)</span>
        {" · "}
        Identity: <span className="text-gray-600">DID-based (did:agntcy:…)</span>
      </div>
    </div>
  );
}
