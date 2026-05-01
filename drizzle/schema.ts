import {
  int,
  bigint,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  float,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Mortgage Applications ────────────────────────────────────────────────────

export const applications = mysqlTable("applications", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull().unique(),
  scenarioType: varchar("scenarioType", { length: 64 }),

  // Borrower
  borrowerName: varchar("borrowerName", { length: 255 }).notNull(),
  borrowerAge: int("borrowerAge"),
  borrowerEmail: varchar("borrowerEmail", { length: 320 }),
  borrowerPhone: varchar("borrowerPhone", { length: 32 }),
  borrowerSsn: varchar("borrowerSsn", { length: 16 }),

  // Employment
  employerName: varchar("employerName", { length: 255 }),
  jobTitle: varchar("jobTitle", { length: 255 }),
  yearsEmployed: float("yearsEmployed"),
  annualIncome: float("annualIncome"),
  employmentType: varchar("employmentType", { length: 64 }),

  // Loan Request
  loanAmount: float("loanAmount").notNull(),
  loanTermMonths: int("loanTermMonths").notNull(),
  loanPurpose: varchar("loanPurpose", { length: 64 }),
  downPayment: float("downPayment"),

  // Property
  propertyAddress: varchar("propertyAddress", { length: 512 }),
  propertyType: varchar("propertyType", { length: 64 }),
  propertyValue: float("propertyValue"),
  propertySquareFeet: int("propertySquareFeet"),
  propertyBedrooms: int("propertyBedrooms"),
  propertyBathrooms: float("propertyBathrooms"),
  propertyYearBuilt: int("propertyYearBuilt"),
  propertyState: varchar("propertyState", { length: 4 }),
  propertyZip: varchar("propertyZip", { length: 16 }),

  // Credit
  creditScore: int("creditScore"),
  existingDebtsMonthly: float("existingDebtsMonthly"),

  // Pipeline state
  status: mysqlEnum("status", [
    "pending",
    "processing",
    "completed",
    "failed",
  ])
    .default("pending")
    .notNull(),

  // Final decision
  decision: mysqlEnum("decision", [
    "approved",
    "conditional_approval",
    "denied",
    "review_required",
  ]),
  decisionRationale: text("decisionRationale"),
  interestRate: float("interestRate"),
  monthlyPayment: float("monthlyPayment"),
  approvedAmount: float("approvedAmount"),

  // Agent results (stored as JSON)
  applicationProcessorResult: json("applicationProcessorResult"),
  creditAnalyzerResult: json("creditAnalyzerResult"),
  collateralValuatorResult: json("collateralValuatorResult"),
  complianceCheckerResult: json("complianceCheckerResult"),
  riskScorerResult: json("riskScorerResult"),
  decisionEngineResult: json("decisionEngineResult"),
  documentationGeneratorResult: json("documentationGeneratorResult"),

  processingStartedAt: timestamp("processingStartedAt"),
  processingCompletedAt: timestamp("processingCompletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Application = typeof applications.$inferSelect;
export type InsertApplication = typeof applications.$inferInsert;

// ─── Agent Events (for real-time pipeline visualization) ─────────────────────

export const agentEvents = mysqlTable("agent_events", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull(),
  agentId: varchar("agentId", { length: 64 }).notNull(),
  agentName: varchar("agentName", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"])
    .default("pending")
    .notNull(),
  inputData: json("inputData"),
  outputData: json("outputData"),
  errorMessage: text("errorMessage"),
  durationMs: int("durationMs"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentEvent = typeof agentEvents.$inferSelect;
export type InsertAgentEvent = typeof agentEvents.$inferInsert;

// ─── Audit Trail ─────────────────────────────────────────────────────────────

export const auditTrail = mysqlTable("audit_trail", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  agentId: varchar("agentId", { length: 64 }),
  agentName: varchar("agentName", { length: 128 }),
  description: text("description").notNull(),
  details: json("details"),
  severity: mysqlEnum("severity", ["info", "warning", "error", "critical"])
    .default("info")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditTrailEntry = typeof auditTrail.$inferSelect;
export type InsertAuditTrailEntry = typeof auditTrail.$inferInsert;

// ─── SLIM Messages (inter-agent protocol envelopes) ───────────────────────────

export const slimMessages = mysqlTable("slim_messages", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull(),
  messageId: varchar("messageId", { length: 64 }).notNull().unique(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  // Routing
  sourceAgentId: varchar("sourceAgentId", { length: 128 }).notNull(),
  sourceAgentDid: varchar("sourceAgentDid", { length: 512 }).notNull(),
  destinationAgentId: varchar("destinationAgentId", { length: 128 }).notNull(),
  destinationAgentDid: varchar("destinationAgentDid", { length: 512 }).notNull(),
  channel: varchar("channel", { length: 512 }).notNull(),
  pattern: mysqlEnum("pattern", ["request-reply", "pub-sub", "fire-and-forget", "streaming"]).notNull(),
  // Security
  encryptionAlgo: varchar("encryptionAlgo", { length: 64 }).default("MLS").notNull(),
  identityVerified: boolean("identityVerified").default(true).notNull(),
  signatureValid: boolean("signatureValid").default(true).notNull(),
  // Payload
  payloadSchema: varchar("payloadSchema", { length: 512 }).notNull(),
  payloadSizeBytes: int("payloadSizeBytes"),
  payloadPreview: text("payloadPreview"),
  // Metadata
  correlationId: varchar("correlationId", { length: 64 }),
  hopCount: int("hopCount").default(1).notNull(),
  latencyMs: int("latencyMs"),
  status: mysqlEnum("status", ["sent", "delivered", "acknowledged", "failed"]).default("sent").notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  deliveredAt: timestamp("deliveredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SlimMessage = typeof slimMessages.$inferSelect;
export type InsertSlimMessage = typeof slimMessages.$inferInsert;

// ─── OpenTelemetry Spans (observability traces) ───────────────────────────────

export const otelSpans = mysqlTable("otel_spans", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull(),
  traceId: varchar("traceId", { length: 64 }).notNull(),
  spanId: varchar("spanId", { length: 64 }).notNull().unique(),
  parentSpanId: varchar("parentSpanId", { length: 64 }),
  operationName: varchar("operationName", { length: 256 }).notNull(),
  serviceName: varchar("serviceName", { length: 128 }).notNull(),
  agentId: varchar("agentId", { length: 128 }),
  status: mysqlEnum("status", ["ok", "error", "unset"]).default("ok").notNull(),
  startTimeMs: bigint("startTimeMs", { mode: "number" }).notNull(),
  endTimeMs: bigint("endTimeMs", { mode: "number" }),
  durationMs: int("durationMs"),
  attributes: json("attributes"),
  events: json("events"),
  kind: mysqlEnum("kind", ["server", "client", "producer", "consumer", "internal"]).default("internal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OtelSpan = typeof otelSpans.$inferSelect;
export type InsertOtelSpan = typeof otelSpans.$inferInsert;

// ─── Agent Directory Entries (DIR announce/discover log) ──────────────────────

export const dirEvents = mysqlTable("dir_events", {
  id: int("id").autoincrement().primaryKey(),
  applicationId: varchar("applicationId", { length: 64 }).notNull(),
  eventType: mysqlEnum("eventType", ["announce", "discover", "resolve", "heartbeat"]).notNull(),
  agentId: varchar("agentId", { length: 128 }).notNull(),
  agentDid: varchar("agentDid", { length: 512 }).notNull(),
  queryCapability: varchar("queryCapability", { length: 256 }),
  queryDomain: varchar("queryDomain", { length: 256 }),
  resultCount: int("resultCount"),
  oasfRecord: json("oasfRecord"),
  latencyMs: int("latencyMs"),
  success: boolean("success").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DirEvent = typeof dirEvents.$inferSelect;
export type InsertDirEvent = typeof dirEvents.$inferInsert;
