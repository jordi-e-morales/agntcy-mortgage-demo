import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mock the DB module ───────────────────────────────────────────────────────

vi.mock("./db", () => ({
  createApplication: vi.fn().mockResolvedValue(undefined),
  getApplicationById: vi.fn().mockResolvedValue({
    applicationId: "APP-TEST-001",
    borrowerName: "Test Borrower",
    loanAmount: 400000,
    loanTermMonths: 360,
    status: "completed",
    decision: "approved",
    interestRate: 6.75,
    monthlyPayment: 2594,
    creditScore: 750,
    scenarioType: null,
    propertyAddress: "123 Test St",
    loanPurpose: "Purchase",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  listApplications: vi.fn().mockResolvedValue([]),
  getAgentEventsByApplicationId: vi.fn().mockResolvedValue([]),
  getAuditTrailByApplicationId: vi.fn().mockResolvedValue([]),
  getDashboardMetrics: vi.fn().mockResolvedValue({
    totalApplications: 5,
    approvedCount: 2,
    conditionalCount: 2,
    deniedCount: 1,
    approvalRate: 80,
    avgInterestRate: "6.85",
    avgProcessingTimeSec: 45,
    compliancePassRate: 90,
    agentStats: [],
  }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  createAgentEvent: vi.fn().mockResolvedValue(1),
  updateAgentEvent: vi.fn().mockResolvedValue(undefined),
  addAuditEntry: vi.fn().mockResolvedValue(undefined),
  updateApplication: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock the pipeline ────────────────────────────────────────────────────────

vi.mock("./agents/pipeline", () => ({
  runMortgagePipeline: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("mortgage.getTestScenarios", () => {
  it("returns exactly 5 scenarios", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const scenarios = await caller.mortgage.getTestScenarios();
    expect(scenarios).toHaveLength(5);
  });

  it("includes all required scenario IDs", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const scenarios = await caller.mortgage.getTestScenarios();
    const ids = scenarios.map((s) => s.id);
    expect(ids).toContain("prime-borrower");
    expect(ids).toContain("good-borrower");
    expect(ids).toContain("denied");
    expect(ids).toContain("compliance-trigger");
    expect(ids).toContain("complex-application");
  });

  it("each scenario has required fields", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const scenarios = await caller.mortgage.getTestScenarios();
    for (const s of scenarios) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.expectedDecision).toBeTruthy();
      expect(s.badge).toBeTruthy();
    }
  });
});

describe("mortgage.getAgentDirectory", () => {
  it("returns exactly 7 agents", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const agents = await caller.mortgage.getAgentDirectory();
    expect(agents).toHaveLength(7);
  });

  it("includes all pipeline agent IDs", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const agents = await caller.mortgage.getAgentDirectory();
    const ids = agents.map((a) => a.id);
    expect(ids).toContain("application-processor-v1");
    expect(ids).toContain("credit-analyzer-v1");
    expect(ids).toContain("collateral-valuator-v1");
    expect(ids).toContain("compliance-checker-v1");
    expect(ids).toContain("risk-scorer-v1");
    expect(ids).toContain("decision-engine-v1");
    expect(ids).toContain("documentation-generator-v1");
  });

  it("all agents have OASF capabilities defined", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const agents = await caller.mortgage.getAgentDirectory();
    for (const agent of agents) {
      expect(agent.capabilities).toBeDefined();
      expect(Array.isArray(agent.capabilities)).toBe(true);
      expect(agent.capabilities.length).toBeGreaterThan(0);
    }
  });
});

describe("mortgage.getDashboardMetrics", () => {
  it("returns metrics with correct shape", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const metrics = await caller.mortgage.getDashboardMetrics();
    expect(metrics).toBeDefined();
    expect(typeof metrics?.totalApplications).toBe("number");
    expect(typeof metrics?.approvalRate).toBe("number");
    expect(typeof metrics?.compliancePassRate).toBe("number");
    expect(Array.isArray(metrics?.agentStats)).toBe(true);
  });
});

describe("mortgage.submitApplication", () => {
  it("returns an applicationId", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mortgage.submitApplication({
      borrowerName: "Test Borrower",
      loanAmount: 400000,
      loanTermMonths: 360,
    });
    expect(result.applicationId).toBeTruthy();
    expect(result.applicationId).toMatch(/^APP-/);
  });
});

describe("mortgage.runScenario", () => {
  it("returns applicationId and scenarioName for valid scenario", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mortgage.runScenario({ scenarioId: "prime-borrower" });
    expect(result.applicationId).toBeTruthy();
    expect(result.scenarioName).toBe("Prime Borrower");
  });

  it("throws for invalid scenario ID", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.mortgage.runScenario({ scenarioId: "nonexistent-scenario" })
    ).rejects.toThrow("not found");
  });
});

describe("mortgage.getApplication", () => {
  it("returns application and agentEvents", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.mortgage.getApplication({ applicationId: "APP-TEST-001" });
    expect(result.application).toBeDefined();
    expect(result.application.applicationId).toBe("APP-TEST-001");
    expect(Array.isArray(result.agentEvents)).toBe(true);
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies).toHaveLength(1);
  });
});
