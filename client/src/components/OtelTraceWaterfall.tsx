import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, ChevronRight } from "lucide-react";
import { useState } from "react";

interface OtelTraceWaterfallProps {
  applicationId: string;
}

const KIND_COLOR: Record<string, string> = {
  server: "bg-blue-500",
  client: "bg-purple-500",
  producer: "bg-green-500",
  consumer: "bg-amber-500",
  internal: "bg-gray-400",
};

const STATUS_COLOR: Record<string, string> = {
  ok: "text-green-700 bg-green-50 border-green-200",
  error: "text-red-700 bg-red-50 border-red-200",
  unset: "text-gray-500 bg-gray-50 border-gray-200",
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function OtelTraceWaterfall({ applicationId }: OtelTraceWaterfallProps) {
  const [expandedSpan, setExpandedSpan] = useState<string | null>(null);

  const { data: spans = [], isLoading } = trpc.mortgage.getOtelSpans.useQuery(
    { applicationId },
    { refetchInterval: 2000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        <Activity className="w-4 h-4 mr-2 animate-pulse" />
        Waiting for trace spans…
      </div>
    );
  }

  if (spans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-400">
        <Activity className="w-8 h-8" />
        <p className="text-sm">No OTel spans yet. Run a pipeline to see the trace.</p>
      </div>
    );
  }

  // Compute timeline bounds
  const minStart = Math.min(...spans.map((s) => s.startTimeMs));
  const maxEnd = Math.max(...spans.map((s) => s.endTimeMs ?? s.startTimeMs + 1));
  const totalDuration = maxEnd - minStart || 1;

  // Group by traceId
  const traceIds = Array.from(new Set(spans.map((s) => s.traceId)));
  const traceId = traceIds[0] ?? "—";

  return (
    <div className="space-y-4">
      {/* Trace header */}
      <div className="border border-black p-3 bg-gray-50 font-mono text-xs space-y-1">
        <div className="flex gap-4">
          <span className="text-gray-500 uppercase tracking-widest">Trace ID</span>
          <span className="font-bold">{traceId}</span>
        </div>
        <div className="flex gap-4">
          <span className="text-gray-500 uppercase tracking-widest">Total Duration</span>
          <span className="font-bold">{formatMs(totalDuration)}</span>
        </div>
        <div className="flex gap-4">
          <span className="text-gray-500 uppercase tracking-widest">Spans</span>
          <span className="font-bold">{spans.length}</span>
        </div>
        <div className="flex gap-4">
          <span className="text-gray-500 uppercase tracking-widest">Services</span>
          <span className="font-bold">{Array.from(new Set(spans.map((s) => s.serviceName))).length}</span>
        </div>
      </div>

      {/* Waterfall */}
      <div className="border border-black overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[280px_1fr_80px] border-b border-black bg-black text-white text-[10px] font-bold uppercase tracking-widest px-3 py-2">
          <div>Operation</div>
          <div>Timeline</div>
          <div className="text-right">Duration</div>
        </div>

        <ScrollArea className="h-[400px]">
          {spans.map((span) => {
            const offsetPct = ((span.startTimeMs - minStart) / totalDuration) * 100;
            const widthPct = Math.max(0.5, (((span.endTimeMs ?? span.startTimeMs + 1) - span.startTimeMs) / totalDuration) * 100);
            const isExpanded = expandedSpan === span.spanId;
            const attrs = (span.attributes ?? {}) as Record<string, unknown>;
            const events = (span.events ?? []) as Array<{ name: string; timeMs: number }>;
            const isRoot = !span.parentSpanId;
            const isError = span.status === "error";

            return (
              <div key={span.spanId} className={`border-b border-gray-100 ${isError ? "bg-red-50/30" : ""}`}>
                <div
                  className="grid grid-cols-[280px_1fr_80px] px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setExpandedSpan(isExpanded ? null : span.spanId)}
                >
                  {/* Operation name */}
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <ChevronRight
                      className={`w-3 h-3 shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${KIND_COLOR[span.kind ?? "internal"] ?? "bg-gray-400"}`}
                    />
                    <div className="min-w-0">
                      <div className={`text-xs font-mono truncate ${isRoot ? "font-bold" : ""}`}>
                        {span.operationName}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">{span.serviceName}</div>
                    </div>
                  </div>

                  {/* Waterfall bar */}
                  <div className="relative flex items-center h-full py-1">
                    <div className="absolute inset-y-1 left-0 right-0 bg-gray-50 rounded" />
                    <div
                      className={`absolute h-5 rounded transition-all ${
                        isError ? "bg-red-500" : isRoot ? "bg-black" : "bg-red-600"
                      }`}
                      style={{
                        left: `${offsetPct}%`,
                        width: `${widthPct}%`,
                        minWidth: "3px",
                      }}
                    />
                  </div>

                  {/* Duration */}
                  <div className="text-right">
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border text-[11px] ${STATUS_COLOR[span.status ?? "ok"]}`}>
                      {formatMs(span.durationMs ?? 0)}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-8 pb-3 space-y-3 bg-gray-50 border-t border-gray-100">
                    {/* IDs */}
                    <div className="font-mono text-[10px] space-y-0.5 pt-2">
                      <div><span className="text-gray-400">span_id: </span><span className="text-gray-700">{span.spanId}</span></div>
                      {span.parentSpanId && (
                        <div><span className="text-gray-400">parent_id: </span><span className="text-gray-700">{span.parentSpanId}</span></div>
                      )}
                      <div><span className="text-gray-400">trace_id: </span><span className="text-gray-700">{span.traceId}</span></div>
                      <div><span className="text-gray-400">kind: </span><span className="text-gray-700">{span.kind}</span></div>
                      <div><span className="text-gray-400">status: </span>
                        <Badge variant="outline" className={`text-[10px] ml-1 ${STATUS_COLOR[span.status ?? "ok"]}`}>
                          {span.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Attributes */}
                    {Object.keys(attrs).length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Attributes</div>
                        <div className="font-mono text-[10px] space-y-0.5 bg-white border border-gray-200 rounded p-2">
                          {Object.entries(attrs).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="text-blue-600 shrink-0">{k}:</span>
                              <span className="text-gray-700 truncate">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Events */}
                    {events.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Events</div>
                        <div className="space-y-0.5">
                          {events.map((ev, i) => (
                            <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="text-gray-600">{ev.name}</span>
                              <span className="text-gray-400">+{formatMs(ev.timeMs - span.startTimeMs)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </ScrollArea>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
        {Object.entries(KIND_COLOR).map(([kind, color]) => (
          <div key={kind} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="capitalize">{kind}</span>
          </div>
        ))}
        <span className="text-gray-300">|</span>
        <span>Click a row to expand span details</span>
      </div>
    </div>
  );
}
