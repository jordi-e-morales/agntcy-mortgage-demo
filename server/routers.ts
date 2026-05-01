import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  createApplication,
  getApplicationById,
  listApplications,
  getAgentEventsByApplicationId,
  getAuditTrailByApplicationId,
  getDashboardMetrics,
} from "./db";
import { runMortgagePipeline } from "./agents/pipeline";
import { AGENT_REGISTRY } from "./agents/registry";
import { TEST_SCENARIOS, getScenarioById } from "./agents/scenarios";

// ─── Application Input Schema ─────────────────────────────────────────────────

const ApplicationInputSchema = z.object({
  borrowerName: z.string().min(1),
  borrowerAge: z.number().optional(),
  borrowerEmail: z.string().optional(),
  borrowerPhone: z.string().optional(),
  employerName: z.string().optional(),
  jobTitle: z.string().optional(),
  yearsEmployed: z.number().optional(),
  annualIncome: z.number().optional(),
  employmentType: z.string().optional(),
  loanAmount: z.number().min(1),
  loanTermMonths: z.number().min(12),
  loanPurpose: z.string().optional(),
  downPayment: z.number().optional(),
  propertyAddress: z.string().optional(),
  propertyType: z.string().optional(),
  propertyValue: z.number().optional(),
  propertySquareFeet: z.number().optional(),
  propertyBedrooms: z.number().optional(),
  propertyBathrooms: z.number().optional(),
  propertyYearBuilt: z.number().optional(),
  propertyState: z.string().optional(),
  propertyZip: z.string().optional(),
  creditScore: z.number().optional(),
  existingDebtsMonthly: z.number().optional(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Mortgage Procedures ─────────────────────────────────────────────────

  mortgage: router({
    // Submit a new application and kick off the pipeline asynchronously
    submitApplication: publicProcedure
      .input(ApplicationInputSchema)
      .mutation(async ({ input }) => {
        const applicationId = `APP-${Date.now()}-${nanoid(6).toUpperCase()}`;

        await createApplication({
          applicationId,
          ...input,
          status: "pending",
        });

        // Run pipeline in background (no await)
        runMortgagePipeline({ applicationId, ...input }).catch((err) => {
          console.error(`[Pipeline] Failed for ${applicationId}:`, err);
        });

        return { applicationId };
      }),

    // Run a pre-built test scenario
    runScenario: publicProcedure
      .input(z.object({ scenarioId: z.string() }))
      .mutation(async ({ input }) => {
        const scenario = getScenarioById(input.scenarioId);
        if (!scenario) throw new Error(`Scenario '${input.scenarioId}' not found`);

        const applicationId = `APP-${Date.now()}-${nanoid(6).toUpperCase()}`;

        await createApplication({
          applicationId,
          ...scenario.data,
          scenarioType: scenario.id,
          status: "pending",
        });

        // Run pipeline in background
        runMortgagePipeline({ applicationId, ...scenario.data }).catch((err) => {
          console.error(`[Pipeline] Failed for ${applicationId}:`, err);
        });

        return { applicationId, scenarioName: scenario.name };
      }),

    // Get full application state (polls for real-time updates)
    getApplication: publicProcedure
      .input(z.object({ applicationId: z.string() }))
      .query(async ({ input }) => {
        const app = await getApplicationById(input.applicationId);
        if (!app) throw new Error("Application not found");

        const agentEvents = await getAgentEventsByApplicationId(input.applicationId);

        return { application: app, agentEvents };
      }),

    // List recent applications
    listApplications: publicProcedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return listApplications(input.limit);
      }),

    // Get audit trail
    getAuditTrail: publicProcedure
      .input(z.object({ applicationId: z.string() }))
      .query(async ({ input }) => {
        return getAuditTrailByApplicationId(input.applicationId);
      }),

    // Dashboard metrics
    getDashboardMetrics: publicProcedure.query(async () => {
      return getDashboardMetrics();
    }),

    // AGNTCY Agent Directory
    getAgentDirectory: publicProcedure.query(() => {
      return AGENT_REGISTRY;
    }),

    // Test scenarios list
    getTestScenarios: publicProcedure.query(() => {
      return TEST_SCENARIOS.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        expectedDecision: s.expectedDecision,
        badge: s.badge,
      }));
    }),
  }),
});

export type AppRouter = typeof appRouter;
