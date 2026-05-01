import { nanoid } from "nanoid";
import { addSlimMessage, addOtelSpan, addDirEvent } from "../db";
import { AGENT_REGISTRY } from "./registry";

// ─── DID helpers ─────────────────────────────────────────────────────────────

export function agentDid(agentId: string): string {
  return `did:agntcy:mortgage-demo/${agentId}`;
}

export function pipelineChannel(stage: string): string {
  return `did:agntcy:mortgage-demo/pipeline/${stage}`;
}

// ─── SLIM Message Emitter ─────────────────────────────────────────────────────

export interface SlimEmitOptions {
  applicationId: string;
  sessionId: string;
  correlationId: string;
  sourceAgentId: string;
  destinationAgentId: string;
  pattern: "request-reply" | "pub-sub" | "fire-and-forget" | "streaming";
  channel: string;
  payloadSchema: string;
  payloadPreview: string;
  payloadSizeBytes: number;
  latencyMs?: number;
}

export async function emitSlimMessage(opts: SlimEmitOptions): Promise<void> {
  const messageId = `msg_${nanoid(16)}`;
  const now = new Date();
  const deliveredAt = opts.latencyMs
    ? new Date(now.getTime() + opts.latencyMs)
    : now;

  await addSlimMessage({
    applicationId: opts.applicationId,
    messageId,
    sessionId: opts.sessionId,
    sourceAgentId: opts.sourceAgentId,
    sourceAgentDid: agentDid(opts.sourceAgentId),
    destinationAgentId: opts.destinationAgentId,
    destinationAgentDid: agentDid(opts.destinationAgentId),
    channel: opts.channel,
    pattern: opts.pattern,
    encryptionAlgo: "MLS",
    identityVerified: true,
    signatureValid: true,
    payloadSchema: opts.payloadSchema,
    payloadSizeBytes: opts.payloadSizeBytes,
    payloadPreview: opts.payloadPreview,
    correlationId: opts.correlationId,
    hopCount: 1,
    latencyMs: opts.latencyMs ?? Math.floor(Math.random() * 8) + 2,
    status: "acknowledged",
    sentAt: now,
    deliveredAt,
  });
}

// ─── OTel Span Emitter ────────────────────────────────────────────────────────

export interface OtelSpanOptions {
  applicationId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  agentId?: string;
  startTimeMs: number;
  endTimeMs: number;
  status?: "ok" | "error" | "unset";
  kind?: "server" | "client" | "producer" | "consumer" | "internal";
  attributes?: Record<string, unknown>;
  events?: Array<{ name: string; timeMs: number; attributes?: Record<string, unknown> }>;
}

export async function emitOtelSpan(opts: OtelSpanOptions): Promise<string> {
  const spanId = `span_${nanoid(12)}`;
  const durationMs = opts.endTimeMs - opts.startTimeMs;

  await addOtelSpan({
    applicationId: opts.applicationId,
    traceId: opts.traceId,
    spanId,
    parentSpanId: opts.parentSpanId ?? null,
    operationName: opts.operationName,
    serviceName: opts.serviceName,
    agentId: opts.agentId ?? null,
    status: opts.status ?? "ok",
    startTimeMs: opts.startTimeMs,
    endTimeMs: opts.endTimeMs,
    durationMs,
    attributes: (opts.attributes ?? {}) as Record<string, unknown>,
    events: (opts.events ?? []) as unknown[],
    kind: opts.kind ?? "internal",
  });

  return spanId;
}

// ─── DIR Event Emitter ────────────────────────────────────────────────────────

export async function emitDirAnnounce(
  applicationId: string,
  agentId: string
): Promise<void> {
  const agent = AGENT_REGISTRY.find((a) => a.id === agentId);
  if (!agent) return;

  const oasfRecord = {
    schema_version: "1.0.0",
    name: agent.name,
    version: agent.version,
    description: agent.description,
    locators: [{ type: "slim", address: agentDid(agentId) }],
    skills: agent.capabilities.map((s: string) => ({ name: s, version: "1.0" })),
    domains: agent.tags,
    extensions: {
      "agntcy.mortgage": agent.oasfMetadata,
    },
    metadata: {
      framework: "LangGraph",
      author: "AGNTCY Mortgage Demo",
      license: "Apache-2.0",
    },
  };

  await addDirEvent({
    applicationId,
    eventType: "announce",
    agentId,
    agentDid: agentDid(agentId),
    queryCapability: null,
    queryDomain: null,
    resultCount: null,
    oasfRecord,
    latencyMs: Math.floor(Math.random() * 15) + 5,
    success: true,
  });
}

export async function emitDirDiscover(
  applicationId: string,
  requestingAgentId: string,
  capability: string,
  domain: string,
  resolvedAgentId: string
): Promise<void> {
  await addDirEvent({
    applicationId,
    eventType: "discover",
    agentId: requestingAgentId,
    agentDid: agentDid(requestingAgentId),
    queryCapability: capability,
    queryDomain: domain,
    resultCount: 1,
    oasfRecord: { resolved: resolvedAgentId, did: agentDid(resolvedAgentId) },
    latencyMs: Math.floor(Math.random() * 20) + 8,
    success: true,
  });
}

export async function emitDirResolve(
  applicationId: string,
  agentId: string
): Promise<void> {
  const agent = AGENT_REGISTRY.find((a) => a.id === agentId);
  if (!agent) return;

  await addDirEvent({
    applicationId,
    eventType: "resolve",
    agentId,
    agentDid: agentDid(agentId),
    queryCapability: null,
    queryDomain: null,
    resultCount: 1,
    oasfRecord: {
      name: agent.name,
      version: agent.version,
      did: agentDid(agentId),
      status: "active",
    },
    latencyMs: Math.floor(Math.random() * 10) + 3,
    success: true,
  });
}
