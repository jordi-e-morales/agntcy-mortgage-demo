import { eq, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  applications,
  InsertApplication,
  Application,
  agentEvents,
  InsertAgentEvent,
  AgentEvent,
  auditTrail,
  InsertAuditTrailEntry,
  AuditTrailEntry,
  slimMessages,
  InsertSlimMessage,
  SlimMessage,
  otelSpans,
  InsertOtelSpan,
  OtelSpan,
  dirEvents,
  InsertDirEvent,
  DirEvent,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Applications ─────────────────────────────────────────────────────────────

export async function createApplication(data: InsertApplication): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(applications).values(data);
}

export async function getApplicationById(applicationId: string): Promise<Application | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(applications)
    .where(eq(applications.applicationId, applicationId))
    .limit(1);
  return result[0];
}

export async function updateApplication(
  applicationId: string,
  data: Partial<InsertApplication>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(applications)
    .set(data)
    .where(eq(applications.applicationId, applicationId));
}

export async function listApplications(limit = 20): Promise<Application[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(applications).orderBy(desc(applications.createdAt)).limit(limit);
}

// ─── Agent Events ─────────────────────────────────────────────────────────────

export async function createAgentEvent(data: InsertAgentEvent): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(agentEvents).values(data);
  return (result as unknown as { insertId: number }).insertId;
}

export async function updateAgentEvent(
  id: number,
  data: Partial<InsertAgentEvent>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(agentEvents).set(data).where(eq(agentEvents.id, id));
}

export async function getAgentEventsByApplicationId(applicationId: string): Promise<AgentEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.applicationId, applicationId))
    .orderBy(agentEvents.createdAt);
}

// ─── Audit Trail ─────────────────────────────────────────────────────────────

export async function addAuditEntry(data: InsertAuditTrailEntry): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditTrail).values(data);
}

export async function getAuditTrailByApplicationId(
  applicationId: string
): Promise<AuditTrailEntry[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(auditTrail)
    .where(eq(auditTrail.applicationId, applicationId))
    .orderBy(auditTrail.createdAt);
}

// ─── SLIM Messages ────────────────────────────────────────────────────────────

export async function addSlimMessage(data: InsertSlimMessage): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(slimMessages).values(data);
}

export async function getSlimMessagesByApplicationId(applicationId: string): Promise<SlimMessage[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(slimMessages)
    .where(eq(slimMessages.applicationId, applicationId))
    .orderBy(slimMessages.sentAt);
}

// ─── OTel Spans ───────────────────────────────────────────────────────────────

export async function addOtelSpan(data: InsertOtelSpan): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(otelSpans).values(data);
}

export async function getOtelSpansByApplicationId(applicationId: string): Promise<OtelSpan[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(otelSpans)
    .where(eq(otelSpans.applicationId, applicationId))
    .orderBy(otelSpans.startTimeMs);
}

// ─── DIR Events ───────────────────────────────────────────────────────────────

export async function addDirEvent(data: InsertDirEvent): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(dirEvents).values(data);
}

export async function getDirEventsByApplicationId(applicationId: string): Promise<DirEvent[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dirEvents)
    .where(eq(dirEvents.applicationId, applicationId))
    .orderBy(dirEvents.createdAt);
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

export async function getDashboardMetrics() {
  const db = await getDb();
  if (!db) return null;

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.status, "completed"));

  const [approvedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.decision, "approved"));

  const [conditionalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.decision, "conditional_approval"));

  const [deniedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.decision, "denied"));

  const [avgRateRow] = await db
    .select({ avg: sql<number>`avg(interestRate)` })
    .from(applications)
    .where(eq(applications.status, "completed"));

  const [avgTimeRow] = await db
    .select({
      avg: sql<number>`avg(TIMESTAMPDIFF(SECOND, processingStartedAt, processingCompletedAt))`,
    })
    .from(applications)
    .where(eq(applications.status, "completed"));

  const [complianceRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(applications)
    .where(sql`JSON_EXTRACT(complianceCheckerResult, '$.complianceStatus') = 'compliant'`);

  // Per-agent avg duration
  const agentStats = await db
    .select({
      agentId: agentEvents.agentId,
      agentName: agentEvents.agentName,
      avgDuration: sql<number>`avg(durationMs)`,
      count: sql<number>`count(*)`,
    })
    .from(agentEvents)
    .where(eq(agentEvents.status, "completed"))
    .groupBy(agentEvents.agentId, agentEvents.agentName);

  const total = Number(totalRow?.count ?? 0);
  const approved = Number(approvedRow?.count ?? 0);
  const conditional = Number(conditionalRow?.count ?? 0);
  const denied = Number(deniedRow?.count ?? 0);
  const compliancePassed = Number(complianceRow?.count ?? 0);

  return {
    totalApplications: total,
    approvedCount: approved,
    conditionalCount: conditional,
    deniedCount: denied,
    approvalRate: total > 0 ? Math.round(((approved + conditional) / total) * 100) : 0,
    avgInterestRate: avgRateRow?.avg ? Number(avgRateRow.avg).toFixed(2) : null,
    avgProcessingTimeSec: avgTimeRow?.avg ? Math.round(Number(avgTimeRow.avg)) : null,
    compliancePassRate: total > 0 ? Math.round((compliancePassed / total) * 100) : 0,
    agentStats: agentStats.map((s) => ({
      agentId: s.agentId,
      agentName: s.agentName,
      avgDurationMs: Math.round(Number(s.avgDuration ?? 0)),
      executionCount: Number(s.count),
    })),
  };
}
