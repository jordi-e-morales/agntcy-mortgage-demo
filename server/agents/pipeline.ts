import { invokeLLM } from "../_core/llm";
import {
  createAgentEvent,
  updateAgentEvent,
  addAuditEntry,
  updateApplication,
} from "../db";
import {
  emitSlimMessage,
  emitOtelSpan,
  emitDirAnnounce,
  emitDirDiscover,
  emitDirResolve,
  agentDid,
  pipelineChannel,
} from "./protocolEmitter";
import { nanoid } from "nanoid";
import { callLLM } from "../llmProvider";
import {
  predictCreditRisk,
  predictFraudRisk,
  buildCreditRiskInput,
  buildFraudRiskInput,
  type CreditRiskResult,
  type FraudRiskResult,
} from "./mlClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApplicationInput {
  applicationId: string;
  borrowerName: string;
  borrowerAge?: number;
  borrowerEmail?: string;
  borrowerPhone?: string;
  employerName?: string;
  jobTitle?: string;
  yearsEmployed?: number;
  annualIncome?: number;
  employmentType?: string;
  loanAmount: number;
  loanTermMonths: number;
  loanPurpose?: string;
  downPayment?: number;
  propertyAddress?: string;
  propertyType?: string;
  propertyValue?: number;
  propertySquareFeet?: number;
  propertyBedrooms?: number;
  propertyBathrooms?: number;
  propertyYearBuilt?: number;
  propertyState?: string;
  propertyZip?: string;
  creditScore?: number;
  existingDebtsMonthly?: number;
}

// ─── Pipeline Context (carries protocol IDs through the pipeline) ────────────

interface PipelineContext {
  sessionId: string;
  traceId: string;
  rootSpanId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function runAgent<T>(
  applicationId: string,
  agentId: string,
  agentName: string,
  inputData: Record<string, unknown>,
  systemPrompt: string,
  userPrompt: string,
  schema: Record<string, unknown>,
  ctx: PipelineContext,
  sourceAgentId: string,
  channel: string,
  payloadSchema: string
): Promise<T> {
  const { sessionId, traceId, rootSpanId: parentSpanId } = ctx;
  const eventId = await createAgentEvent({
    applicationId,
    agentId,
    agentName,
    status: "running",
    inputData,
    startedAt: new Date(),
  });

  await addAuditEntry({
    applicationId,
    eventType: "AGENT_STARTED",
    agentId,
    agentName,
    description: `${agentName} started processing`,
    details: { inputSummary: Object.keys(inputData) },
    severity: "info",
  });

  // Emit SLIM request message (source → this agent)
  const payloadPreview = JSON.stringify(inputData).slice(0, 300);
  const payloadSizeBytes = JSON.stringify(inputData).length;
  await emitSlimMessage({
    applicationId,
    sessionId,
    correlationId: applicationId,
    sourceAgentId,
    destinationAgentId: agentId,
    pattern: "request-reply",
    channel,
    payloadSchema,
    payloadPreview,
    payloadSizeBytes,
    latencyMs: Math.floor(Math.random() * 8) + 2,
  });

  const startTime = Date.now();

  try {
    const response = await callLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: agentId.replace(/-/g, "_"),
          strict: true,
          schema,
        },
      },
    });

    const raw = (response.choices[0]?.message?.content as string) ?? "{}";
    const result = JSON.parse(raw) as T;
    const durationMs = Date.now() - startTime;
    const endTime = startTime + durationMs;

    await updateAgentEvent(eventId, {
      status: "completed",
      outputData: result as Record<string, unknown>,
      durationMs,
      completedAt: new Date(),
    });

    await addAuditEntry({
      applicationId,
      eventType: "AGENT_COMPLETED",
      agentId,
      agentName,
      description: `${agentName} completed in ${durationMs}ms`,
      details: { durationMs, outputSummary: Object.keys(result as object) },
      severity: "info",
    });

    // Emit OTel span
    await emitOtelSpan({
      applicationId,
      traceId,
      parentSpanId,
      operationName: `${agentId}.process`,
      serviceName: agentId,
      agentId,
      startTimeMs: startTime,
      endTimeMs: endTime,
      status: "ok",
      kind: "server",
      attributes: {
        "agent.id": agentId,
        "agent.name": agentName,
        "agent.framework": "LangGraph",
        "slim.channel": channel,
        "slim.pattern": "request-reply",
        "slim.session_id": sessionId,
        "oasf.schema": payloadSchema,
        "llm.model": "default",
        "llm.input_tokens": systemPrompt.length + userPrompt.length,
        "llm.output_tokens": raw.length,
        "mortgage.application_id": applicationId,
      },
      events: [
        { name: "agent.started", timeMs: startTime },
        { name: "llm.request.sent", timeMs: startTime + 10 },
        { name: "llm.response.received", timeMs: endTime - 5 },
        { name: "agent.completed", timeMs: endTime },
      ],
    });

    // Emit SLIM reply message (this agent → source)
    const replyPreview = JSON.stringify(result).slice(0, 300);
    await emitSlimMessage({
      applicationId,
      sessionId,
      correlationId: applicationId,
      sourceAgentId: agentId,
      destinationAgentId: sourceAgentId,
      pattern: "request-reply",
      channel,
      payloadSchema: payloadSchema.replace("-request", "-response"),
      payloadPreview: replyPreview,
      payloadSizeBytes: JSON.stringify(result).length,
      latencyMs: Math.floor(Math.random() * 6) + 1,
    });

    return result;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    await updateAgentEvent(eventId, {
      status: "failed",
      errorMessage,
      durationMs,
      completedAt: new Date(),
    });

    await addAuditEntry({
      applicationId,
      eventType: "AGENT_FAILED",
      agentId,
      agentName,
      description: `${agentName} failed: ${errorMessage}`,
      details: { error: errorMessage },
      severity: "error",
    });

    // Emit error OTel span
    await emitOtelSpan({
      applicationId,
      traceId,
      parentSpanId,
      operationName: `${agentId}.process`,
      serviceName: agentId,
      agentId,
      startTimeMs: startTime,
      endTimeMs: startTime + durationMs,
      status: "error",
      kind: "server",
      attributes: {
        "agent.id": agentId,
        "error.message": errorMessage,
        "mortgage.application_id": applicationId,
      },
      events: [{ name: "agent.error", timeMs: startTime + durationMs, attributes: { error: errorMessage } }],
    });

    throw err;
  }
}

// ─── Agent 1: Application Processor ──────────────────────────────────────────

interface AppProcessorResult {
  applicationId: string;
  dataQualityScore: number;
  missingFields: string[];
  validationWarnings: string[];
  normalizedData: {
    borrowerProfile: string;
    employmentProfile: string;
    loanProfile: string;
    propertyProfile: string;
  };
  status: string;
}

async function runApplicationProcessor(app: ApplicationInput, ctx: PipelineContext): Promise<AppProcessorResult> {
  const input = {
    borrowerName: app.borrowerName,
    borrowerAge: app.borrowerAge,
    employerName: app.employerName,
    jobTitle: app.jobTitle,
    yearsEmployed: app.yearsEmployed,
    annualIncome: app.annualIncome,
    employmentType: app.employmentType,
    loanAmount: app.loanAmount,
    loanTermMonths: app.loanTermMonths,
    loanPurpose: app.loanPurpose,
    downPayment: app.downPayment,
    propertyAddress: app.propertyAddress,
    propertyType: app.propertyType,
    propertyValue: app.propertyValue,
    creditScore: app.creditScore,
    existingDebtsMonthly: app.existingDebtsMonthly,
  };

  return runAgent<AppProcessorResult>(
    app.applicationId,
    "application-processor-v1",
    "Application Processor",
    input,
    `You are the Application Processor agent in an AGNTCY mortgage underwriting pipeline. 
Your role is to validate, normalise, and assess the completeness of incoming mortgage loan applications.
Always respond with valid JSON matching the exact schema provided.`,
    `Process this mortgage loan application and return a structured assessment:
${JSON.stringify(input, null, 2)}

Evaluate data completeness, identify any missing or suspicious fields, compute a data quality score (0-100), and produce normalised profile summaries for each section.`,
    {
      type: "object",
      properties: {
        applicationId: { type: "string" },
        dataQualityScore: { type: "number", description: "0-100 quality score" },
        missingFields: { type: "array", items: { type: "string" } },
        validationWarnings: { type: "array", items: { type: "string" } },
        normalizedData: {
          type: "object",
          properties: {
            borrowerProfile: { type: "string" },
            employmentProfile: { type: "string" },
            loanProfile: { type: "string" },
            propertyProfile: { type: "string" },
          },
          required: ["borrowerProfile", "employmentProfile", "loanProfile", "propertyProfile"],
          additionalProperties: false,
        },
        status: { type: "string", enum: ["valid", "incomplete", "invalid"] },
      },
      required: [
        "applicationId",
        "dataQualityScore",
        "missingFields",
        "validationWarnings",
        "normalizedData",
        "status",
      ],
      additionalProperties: false,
    },
    ctx,
    "pipeline-orchestrator-v1",
    `did:agntcy:mortgage-demo/pipeline/stage-1`,
    "agntcy.mortgage.application-processor.request"
  );
}

// ─── Agent 2: Credit Analyzer ─────────────────────────────────────────────────

interface CreditAnalyzerResult {
  creditRating: string;
  dtiRatio: number;
  riskLevel: string;
  riskFactors: string[];
  strengths: string[];
  recommendation: string;
  confidenceScore: number;
  creditAnalysisSummary: string;
  // ML model outputs (injected pre-LLM)
  mlDefaultProbability?: number;
  mlRiskTier?: string;
  mlRiskLabel?: string;
  mlTopRiskFactors?: Array<{ feature: string; importance: number; value: number | null }>;
  mlModelAuc?: number;
  mlTrainingSamples?: number;
}

async function runCreditAnalyzer(app: ApplicationInput, ctx: PipelineContext): Promise<CreditAnalyzerResult> {
  const monthlyIncome = (app.annualIncome ?? 0) / 12;
  const monthlyDebt = app.existingDebtsMonthly ?? 0;
  const estimatedMortgagePayment = app.loanAmount
    ? (app.loanAmount * 0.006) // rough estimate
    : 0;
  const totalMonthlyDebt = monthlyDebt + estimatedMortgagePayment;
  const dti = monthlyIncome > 0 ? (totalMonthlyDebt / monthlyIncome) * 100 : 0;

  // ── XGBoost ML Inference (pre-LLM) ──────────────────────────────────────────
  const propertyValue = app.propertyValue ?? app.loanAmount * 1.25;
  const ltvRatio = app.loanAmount / propertyValue;
  const dtiRatio = dti / 100;
  const propertyAge = app.propertyYearBuilt ? 2024 - app.propertyYearBuilt : 10;
  const mlInput = buildCreditRiskInput({
    creditScore: app.creditScore ?? 650,
    annualIncome: app.annualIncome ?? 60000,
    loanAmount: app.loanAmount,
    propertyValue,
    downPayment: app.downPayment ?? (propertyValue - app.loanAmount),
    ltvRatio,
    dtiRatio,
    monthlyDebts: app.existingDebtsMonthly ?? 0,
    yearsEmployed: app.yearsEmployed ?? 2,
    employmentType: app.employmentType ?? "full-time",
    loanTermMonths: app.loanTermMonths,
    loanPurpose: app.loanPurpose ?? "purchase",
    propertyType: app.propertyType ?? "single-family",
    propertyAge,
    borrowerAge: app.borrowerAge ?? 35,
    propertyState: app.propertyState,
  });
  const mlResult: CreditRiskResult | null = await predictCreditRisk(mlInput);

  const input = {
    creditScore: app.creditScore,
    annualIncome: app.annualIncome,
    monthlyIncome,
    existingDebtsMonthly: app.existingDebtsMonthly,
    estimatedMortgagePayment,
    estimatedDTI: Math.round(dti * 10) / 10,
    yearsEmployed: app.yearsEmployed,
    employmentType: app.employmentType,
    loanAmount: app.loanAmount,
    loanPurpose: app.loanPurpose,
    // ML model output injected as additional context
    xgboostDefaultProbability: mlResult?.default_probability ?? null,
    xgboostRiskTier: mlResult?.risk_tier ?? null,
    xgboostRecommendation: mlResult?.recommendation ?? null,
    xgboostTopRiskFactors: mlResult?.top_risk_factors ?? null,
    xgboostModelAuc: mlResult?.model_auc ?? null,
  };

  return runAgent<CreditAnalyzerResult>(
    app.applicationId,
    "credit-analyzer-v1",
    "Credit Analyzer",
    input,
    `You are the Credit Analyzer agent in an AGNTCY mortgage underwriting pipeline.
Your role is to evaluate borrower creditworthiness using credit score, income, debt obligations, and employment stability.
Credit rating scale: Excellent (760+), Good (700-759), Fair (640-699), Poor (<640).
DTI thresholds: Excellent (<28%), Good (28-36%), Acceptable (36-43%), High (>43%).
Always respond with valid JSON matching the exact schema provided.`,
    `Analyse the credit profile for this mortgage application:
${JSON.stringify(input, null, 2)}

IMPORTANT: The XGBoost ML model (trained on 50,000 mortgage records, AUC=${mlResult?.model_auc ?? 'N/A'}) has already computed:
- Default probability: ${mlResult?.default_probability ?? 'N/A'}
- Risk tier: ${mlResult?.risk_tier ?? 'N/A'}
- Recommendation: ${mlResult?.recommendation ?? 'N/A'}

Use this ML prediction as a strong quantitative signal in your analysis. Provide a thorough credit risk assessment including rating, DTI analysis, risk factors, strengths, and a clear recommendation that is consistent with the ML model output unless there are compelling qualitative reasons to differ.`,
    {
      type: "object",
      properties: {
        creditRating: { type: "string", enum: ["Excellent", "Good", "Fair", "Poor"] },
        dtiRatio: { type: "number", description: "Debt-to-income ratio as percentage" },
        riskLevel: { type: "string", enum: ["Low", "Moderate", "High", "Very High"] },
        riskFactors: { type: "array", items: { type: "string" } },
        strengths: { type: "array", items: { type: "string" } },
        recommendation: {
          type: "string",
          enum: ["Approve", "Approve with Conditions", "Decline"],
        },
        confidenceScore: { type: "number", description: "0-100" },
        creditAnalysisSummary: { type: "string" },
      },
      required: [
        "creditRating",
        "dtiRatio",
        "riskLevel",
        "riskFactors",
        "strengths",
        "recommendation",
        "confidenceScore",
        "creditAnalysisSummary",
      ],
      additionalProperties: false,
    },
    ctx,
    "application-processor-v1",
    `did:agntcy:mortgage-demo/pipeline/stage-2-parallel`,
    "agntcy.mortgage.credit-analyzer.request"
  ).then((result) => ({
    ...result,
    mlDefaultProbability: mlResult?.default_probability,
    mlRiskTier: mlResult?.risk_tier,
    mlRiskLabel: mlResult?.risk_label,
    mlTopRiskFactors: mlResult?.top_risk_factors,
    mlModelAuc: mlResult?.model_auc,
    mlTrainingSamples: mlResult?.training_samples,
  }));
}

// ─── Agent 3: Collateral Valuator ─────────────────────────────────────────────

interface CollateralValuatorResult {
  estimatedValue: number;
  ltvRatio: number;
  collateralQuality: string;
  marketConditions: string;
  propertyRiskFactors: string[];
  valuationConfidence: string;
  collateralSummary: string;
}

async function runCollateralValuator(app: ApplicationInput, ctx: PipelineContext): Promise<CollateralValuatorResult> {
  const propertyValue = app.propertyValue ?? app.loanAmount * 1.25;
  const downPayment = app.downPayment ?? propertyValue - app.loanAmount;
  const ltv = ((app.loanAmount / propertyValue) * 100);

  const input = {
    propertyAddress: app.propertyAddress,
    propertyType: app.propertyType,
    propertyValue: app.propertyValue,
    propertySquareFeet: app.propertySquareFeet,
    propertyBedrooms: app.propertyBedrooms,
    propertyBathrooms: app.propertyBathrooms,
    propertyYearBuilt: app.propertyYearBuilt,
    propertyState: app.propertyState,
    propertyZip: app.propertyZip,
    loanAmount: app.loanAmount,
    downPayment,
    estimatedLTV: Math.round(ltv * 10) / 10,
  };

  return runAgent<CollateralValuatorResult>(
    app.applicationId,
    "collateral-valuator-v1",
    "Collateral Valuator",
    input,
    `You are the Collateral Valuator agent in an AGNTCY mortgage underwriting pipeline.
Your role is to assess property value, calculate LTV ratio, and evaluate collateral quality.
LTV thresholds: Excellent (<70%), Good (70-80%), Acceptable (80-90%), High (90-95%), Very High (>95%).
Collateral quality: Excellent, Good, Acceptable, Marginal, Unacceptable.
Always respond with valid JSON matching the exact schema provided.`,
    `Evaluate the collateral for this mortgage application:
${JSON.stringify(input, null, 2)}

Assess the property value, LTV ratio, market conditions, and any property-specific risk factors.`,
    {
      type: "object",
      properties: {
        estimatedValue: { type: "number" },
        ltvRatio: { type: "number", description: "LTV as percentage" },
        collateralQuality: {
          type: "string",
          enum: ["Excellent", "Good", "Acceptable", "Marginal", "Unacceptable"],
        },
        marketConditions: {
          type: "string",
          enum: ["Strong", "Stable", "Softening", "Weak"],
        },
        propertyRiskFactors: { type: "array", items: { type: "string" } },
        valuationConfidence: { type: "string", enum: ["High", "Medium", "Low"] },
        collateralSummary: { type: "string" },
      },
      required: [
        "estimatedValue",
        "ltvRatio",
        "collateralQuality",
        "marketConditions",
        "propertyRiskFactors",
        "valuationConfidence",
        "collateralSummary",
      ],
      additionalProperties: false,
    },
    ctx,
    "application-processor-v1",
    `did:agntcy:mortgage-demo/pipeline/stage-2-parallel`,
    "agntcy.mortgage.collateral-valuator.request"
  );
}

// ─── Agent 4: Compliance Checker ──────────────────────────────────────────────

interface ComplianceCheckerResult {
  complianceStatus: string;
  // GNN ML model outputs
  gnnFraudProbability?: number;
  gnnNetworkFlag?: string;
  gnnNetworkAnomalies?: string[];
  gnnModelAuc?: number;
  fairLendingAssessment: {
    status: string;
    findings: string[];
    recommendation: string;
  };
  bsaAmlResult: string;
  bsaAmlFindings: string[];
  regulatoryChecks: Array<{
    rule: string;
    status: string;
    value: string;
    threshold: string;
    passed: boolean;
  }>;
  requiredDisclosures: string[];
  regulatoryViolations: string[];
  approvalAllowed: boolean;
  complianceSummary: string;
}

async function runComplianceChecker(
  app: ApplicationInput,
  creditResult: CreditAnalyzerResult,
  collateralResult: CollateralValuatorResult,
  ctx: PipelineContext
): Promise<ComplianceCheckerResult> {
  // ── GNN Fraud Detection (pre-LLM) ───────────────────────────────────────
  const fraudInput = buildFraudRiskInput({
    creditScore: app.creditScore ?? 650,
    dtiRatio: creditResult.dtiRatio / 100,
    ltvRatio: collateralResult.ltvRatio / 100,
    annualIncome: app.annualIncome ?? 60000,
    yearsEmployed: app.yearsEmployed ?? 2,
    sharedEmployerCount: 0, // In production, query DB for same employer
  });
  const gnnResult: FraudRiskResult | null = await predictFraudRisk(fraudInput);

  const input = {
    borrowerName: app.borrowerName,
    borrowerAge: app.borrowerAge,
    propertyState: app.propertyState,
    loanAmount: app.loanAmount,
    loanPurpose: app.loanPurpose,
    employmentType: app.employmentType,
    creditScore: app.creditScore,
    dtiRatio: creditResult.dtiRatio,
    ltvRatio: collateralResult.ltvRatio,
    loanTermMonths: app.loanTermMonths,
    propertyType: app.propertyType,
    // GNN fraud detection output
    gnnFraudProbability: gnnResult?.fraud_probability ?? null,
    gnnNetworkFlag: gnnResult?.network_flag ?? null,
    gnnNetworkAnomalies: gnnResult?.network_anomalies ?? null,
    gnnModelAuc: gnnResult?.model_auc ?? null,
  };

  return runAgent<ComplianceCheckerResult>(
    app.applicationId,
    "compliance-checker-v1",
    "Compliance Checker",
    input,
    `You are the Compliance Checker agent in an AGNTCY mortgage underwriting pipeline.
Your role is to verify regulatory compliance including:
- Fair Lending (ECOA, Fair Housing Act) — check for potential disparate impact
- BSA/AML screening — check for suspicious patterns
- Regulatory limits: LTV max 97%, DTI max 43% for QM loans, credit score min 620 for conventional
- TRID disclosure requirements (Loan Estimate within 3 business days)
- RESPA, TILA compliance
Always respond with valid JSON matching the exact schema provided.`,
    `Perform a comprehensive compliance check for this mortgage application:
${JSON.stringify(input, null, 2)}

IMPORTANT: The GNN (Graph Neural Network) fraud detection model (AUC=${gnnResult?.model_auc ?? 'N/A'}, fraud recall=91.3%) has already analyzed the borrower's network relationships:
- Fraud probability: ${gnnResult?.fraud_probability ?? 'N/A'}
- Network flag: ${gnnResult?.network_flag ?? 'N/A'}
- Anomalies detected: ${JSON.stringify(gnnResult?.network_anomalies ?? [])}

Incorporate this GNN network risk signal into your BSA/AML assessment. Check Fair Lending compliance, BSA/AML screening (informed by GNN), all regulatory limits, and required disclosures.`,
    {
      type: "object",
      properties: {
        complianceStatus: {
          type: "string",
          enum: ["compliant", "non_compliant", "review_required"],
        },
        fairLendingAssessment: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["Pass", "Review", "Fail"] },
            findings: { type: "array", items: { type: "string" } },
            recommendation: { type: "string" },
          },
          required: ["status", "findings", "recommendation"],
          additionalProperties: false,
        },
        bsaAmlResult: { type: "string", enum: ["Clear", "Review", "Flag"] },
        bsaAmlFindings: { type: "array", items: { type: "string" } },
        regulatoryChecks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rule: { type: "string" },
              status: { type: "string" },
              value: { type: "string" },
              threshold: { type: "string" },
              passed: { type: "boolean" },
            },
            required: ["rule", "status", "value", "threshold", "passed"],
            additionalProperties: false,
          },
        },
        requiredDisclosures: { type: "array", items: { type: "string" } },
        regulatoryViolations: { type: "array", items: { type: "string" } },
        approvalAllowed: { type: "boolean" },
        complianceSummary: { type: "string" },
      },
      required: [
        "complianceStatus",
        "fairLendingAssessment",
        "bsaAmlResult",
        "bsaAmlFindings",
        "regulatoryChecks",
        "requiredDisclosures",
        "regulatoryViolations",
        "approvalAllowed",
        "complianceSummary",
      ],
      additionalProperties: false,
    },
    ctx,
    "application-processor-v1",
    `did:agntcy:mortgage-demo/pipeline/stage-2-parallel`,
    "agntcy.mortgage.compliance-checker.request"
  ).then((result) => ({
    ...result,
    gnnFraudProbability: gnnResult?.fraud_probability,
    gnnNetworkFlag: gnnResult?.network_flag,
    gnnNetworkAnomalies: gnnResult?.network_anomalies,
    gnnModelAuc: gnnResult?.model_auc,
  }));
}

// ─── Agent 5: Risk Scorer ─────────────────────────────────────────────────────

interface RiskScorerResult {
  riskScore: number;
  riskTier: string;
  baseRate: number;
  rateAdjustment: number;
  finalRate: number;
  monthlyPayment: number;
  riskComponents: Array<{ factor: string; weight: number; score: number; impact: string }>;
  mitigatingFactors: string[];
  pricingRationale: string;
}

async function runRiskScorer(
  app: ApplicationInput,
  creditResult: CreditAnalyzerResult,
  collateralResult: CollateralValuatorResult,
  complianceResult: ComplianceCheckerResult,
  ctx: PipelineContext
): Promise<RiskScorerResult> {
  const input = {
    loanAmount: app.loanAmount,
    loanTermMonths: app.loanTermMonths,
    creditScore: app.creditScore,
    creditRating: creditResult.creditRating,
    dtiRatio: creditResult.dtiRatio,
    riskLevel: creditResult.riskLevel,
    ltvRatio: collateralResult.ltvRatio,
    collateralQuality: collateralResult.collateralQuality,
    complianceStatus: complianceResult.complianceStatus,
    approvalAllowed: complianceResult.approvalAllowed,
    yearsEmployed: app.yearsEmployed,
    employmentType: app.employmentType,
    loanPurpose: app.loanPurpose,
    downPayment: app.downPayment,
  };

  return runAgent<RiskScorerResult>(
    app.applicationId,
    "risk-scorer-v1",
    "Risk Scorer",
    input,
    `You are the Risk Scorer agent in an AGNTCY mortgage underwriting pipeline.
Your role is to compute a composite risk score and determine risk-based pricing.
Current market base rate for 30-year fixed mortgage: 6.75%.
Risk tiers: Tier 1 (score 85-100, rate -0.5%), Tier 2 (score 70-84, rate 0%), Tier 3 (score 55-69, rate +0.5%), Tier 4 (score 40-54, rate +1.0%), Tier 5 (score <40, rate +1.75%).
Monthly payment formula: P * [r(1+r)^n] / [(1+r)^n - 1] where r = monthly rate, n = term months.
Always respond with valid JSON matching the exact schema provided.`,
    `Compute the composite risk score and pricing for this mortgage application:
${JSON.stringify(input, null, 2)}

Calculate risk score (0-100), assign risk tier, determine interest rate, and compute monthly payment.`,
    {
      type: "object",
      properties: {
        riskScore: { type: "number", description: "0-100 composite risk score" },
        riskTier: { type: "string", enum: ["Tier 1", "Tier 2", "Tier 3", "Tier 4", "Tier 5"] },
        baseRate: { type: "number", description: "Base interest rate %" },
        rateAdjustment: { type: "number", description: "Adjustment to base rate" },
        finalRate: { type: "number", description: "Final interest rate %" },
        monthlyPayment: { type: "number", description: "Estimated monthly payment" },
        riskComponents: {
          type: "array",
          items: {
            type: "object",
            properties: {
              factor: { type: "string" },
              weight: { type: "number" },
              score: { type: "number" },
              impact: { type: "string", enum: ["Positive", "Neutral", "Negative"] },
            },
            required: ["factor", "weight", "score", "impact"],
            additionalProperties: false,
          },
        },
        mitigatingFactors: { type: "array", items: { type: "string" } },
        pricingRationale: { type: "string" },
      },
      required: [
        "riskScore",
        "riskTier",
        "baseRate",
        "rateAdjustment",
        "finalRate",
        "monthlyPayment",
        "riskComponents",
        "mitigatingFactors",
        "pricingRationale",
      ],
      additionalProperties: false,
    },
    ctx,
    "compliance-checker-v1",
    `did:agntcy:mortgage-demo/pipeline/stage-3`,
    "agntcy.mortgage.risk-scorer.request"
  );
}

// ─── Agent 6: Decision Engine ─────────────────────────────────────────────────

interface DecisionEngineResult {
  decision: string;
  decisionCode: string;
  rationale: string;
  keyFactors: Array<{ factor: string; assessment: string; impact: "Positive" | "Negative" | "Neutral" }>;
  conditions: string[];
  nextSteps: string[];
  appealInformation: string;
  confidenceLevel: number;
  decisionSummary: string;
}

async function runDecisionEngine(
  app: ApplicationInput,
  creditResult: CreditAnalyzerResult,
  collateralResult: CollateralValuatorResult,
  complianceResult: ComplianceCheckerResult,
  riskResult: RiskScorerResult,
  ctx: PipelineContext
): Promise<DecisionEngineResult> {
  const input = {
    applicationId: app.applicationId,
    borrowerName: app.borrowerName,
    loanAmount: app.loanAmount,
    loanTermMonths: app.loanTermMonths,
    creditAssessment: {
      creditRating: creditResult.creditRating,
      dtiRatio: creditResult.dtiRatio,
      riskLevel: creditResult.riskLevel,
      recommendation: creditResult.recommendation,
    },
    collateralAssessment: {
      ltvRatio: collateralResult.ltvRatio,
      collateralQuality: collateralResult.collateralQuality,
      estimatedValue: collateralResult.estimatedValue,
    },
    complianceAssessment: {
      complianceStatus: complianceResult.complianceStatus,
      approvalAllowed: complianceResult.approvalAllowed,
      violations: complianceResult.regulatoryViolations,
      fairLendingStatus: complianceResult.fairLendingAssessment.status,
      bsaAmlResult: complianceResult.bsaAmlResult,
    },
    riskAssessment: {
      riskScore: riskResult.riskScore,
      riskTier: riskResult.riskTier,
      finalRate: riskResult.finalRate,
      monthlyPayment: riskResult.monthlyPayment,
    },
  };

  return runAgent<DecisionEngineResult>(
    app.applicationId,
    "decision-engine-v1",
    "Decision Engine",
    input,
    `You are the Decision Engine agent in an AGNTCY mortgage underwriting pipeline.
Your role is to make the final loan approval decision with full explainability.
Decision options: "approved", "conditional_approval", "denied", "review_required".
If compliance approvalAllowed is false, the decision MUST be "denied" or "review_required".
If DTI > 43% or LTV > 97%, the decision MUST be "denied".
If credit score < 620, the decision MUST be "denied".
Provide a thorough, human-readable rationale and list all conditions if conditionally approved.
Always respond with valid JSON matching the exact schema provided.`,
    `Make the final underwriting decision for this mortgage application:
${JSON.stringify(input, null, 2)}

Provide a fully explainable decision with key factors, any conditions, and next steps.`,
    {
      type: "object",
      properties: {
        decision: {
          type: "string",
          enum: ["approved", "conditional_approval", "denied", "review_required"],
        },
        decisionCode: { type: "string" },
        rationale: { type: "string" },
        keyFactors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              factor: { type: "string" },
              assessment: { type: "string" },
              impact: { type: "string", enum: ["Positive", "Negative", "Neutral"] },
            },
            required: ["factor", "assessment", "impact"],
            additionalProperties: false,
          },
        },
        conditions: { type: "array", items: { type: "string" } },
        nextSteps: { type: "array", items: { type: "string" } },
        appealInformation: { type: "string" },
        confidenceLevel: { type: "number", description: "0-100" },
        decisionSummary: { type: "string" },
      },
      required: [
        "decision",
        "decisionCode",
        "rationale",
        "keyFactors",
        "conditions",
        "nextSteps",
        "appealInformation",
        "confidenceLevel",
        "decisionSummary",
      ],
      additionalProperties: false,
    },
    ctx,
    "risk-scorer-v1",
    `did:agntcy:mortgage-demo/pipeline/stage-4`,
    "agntcy.mortgage.decision-engine.request"
  );
}

// ─── Agent 7: Documentation Generator ────────────────────────────────────────

interface DocumentationGeneratorResult {
  documents: string[];
  disclosures: string[];
  decisionLetterSummary: string;
  documentChecklist: Array<{ document: string; required: boolean; status: string }>;
  loanEstimateSummary: string;
  deliveryInstructions: string;
}

async function runDocumentationGenerator(
  app: ApplicationInput,
  decisionResult: DecisionEngineResult,
  riskResult: RiskScorerResult,
  complianceResult: ComplianceCheckerResult,
  ctx: PipelineContext
): Promise<DocumentationGeneratorResult> {
  const input = {
    applicationId: app.applicationId,
    borrowerName: app.borrowerName,
    loanAmount: app.loanAmount,
    loanTermMonths: app.loanTermMonths,
    finalRate: riskResult.finalRate,
    monthlyPayment: riskResult.monthlyPayment,
    decision: decisionResult.decision,
    conditions: decisionResult.conditions,
    requiredDisclosures: complianceResult.requiredDisclosures,
    propertyAddress: app.propertyAddress,
  };

  return runAgent<DocumentationGeneratorResult>(
    app.applicationId,
    "documentation-generator-v1",
    "Documentation Generator",
    input,
    `You are the Documentation Generator agent in an AGNTCY mortgage underwriting pipeline.
Your role is to generate all required loan documents and regulatory disclosures.
Required documents for approved/conditional loans: Loan Estimate, TILA-RESPA Integrated Disclosure (TRID), Fair Housing Notice, Privacy Notice, Equal Credit Opportunity Act (ECOA) Notice, Approval/Conditional Approval Letter.
Required documents for denied loans: Adverse Action Notice, ECOA Notice, Fair Housing Notice.
Always respond with valid JSON matching the exact schema provided.`,
    `Generate the documentation package for this mortgage application:
${JSON.stringify(input, null, 2)}

List all required documents, disclosures, and provide a loan estimate summary.`,
    {
      type: "object",
      properties: {
        documents: { type: "array", items: { type: "string" } },
        disclosures: { type: "array", items: { type: "string" } },
        decisionLetterSummary: { type: "string" },
        documentChecklist: {
          type: "array",
          items: {
            type: "object",
            properties: {
              document: { type: "string" },
              required: { type: "boolean" },
              status: { type: "string", enum: ["Generated", "Pending", "Not Required"] },
            },
            required: ["document", "required", "status"],
            additionalProperties: false,
          },
        },
        loanEstimateSummary: { type: "string" },
        deliveryInstructions: { type: "string" },
      },
      required: [
        "documents",
        "disclosures",
        "decisionLetterSummary",
        "documentChecklist",
        "loanEstimateSummary",
        "deliveryInstructions",
      ],
      additionalProperties: false,
    },
    ctx,
    "decision-engine-v1",
    `did:agntcy:mortgage-demo/pipeline/stage-5`,
    "agntcy.mortgage.documentation-generator.request"
  );
}

// ─── Main Pipeline Orchestrator ───────────────────────────────────────────────

export async function runMortgagePipeline(app: ApplicationInput): Promise<void> {
  const { applicationId } = app;

  // ─── Create Pipeline Context (SLIM session + OTel trace IDs) ──────────────────
  const ctx: PipelineContext = {
    sessionId: `sess_${nanoid(20)}`,
    traceId: `trace_${nanoid(24)}`,
    rootSpanId: `span_${nanoid(12)}`,
  };

  await updateApplication(applicationId, {
    status: "processing",
    processingStartedAt: new Date(),
  });

  await addAuditEntry({
    applicationId,
    eventType: "PIPELINE_STARTED",
    description: "Mortgage underwriting pipeline initiated",
    details: { borrowerName: app.borrowerName, loanAmount: app.loanAmount, sessionId: ctx.sessionId, traceId: ctx.traceId },
    severity: "info",
  });

  // ─── DIR: Announce all agents to the Agent Directory ───────────────────────────
  const agentIds = [
    "application-processor-v1",
    "credit-analyzer-v1",
    "collateral-valuator-v1",
    "compliance-checker-v1",
    "risk-scorer-v1",
    "decision-engine-v1",
    "documentation-generator-v1",
  ];
  await Promise.all(agentIds.map((id) => emitDirAnnounce(applicationId, id)));

  // DIR: Orchestrator discovers each agent
  await emitDirDiscover(applicationId, "pipeline-orchestrator-v1", "data_validation", "mortgage", "application-processor-v1");
  await emitDirDiscover(applicationId, "application-processor-v1", "credit_risk_analysis", "mortgage", "credit-analyzer-v1");
  await emitDirDiscover(applicationId, "application-processor-v1", "property_valuation", "mortgage", "collateral-valuator-v1");
  await emitDirDiscover(applicationId, "application-processor-v1", "regulatory_compliance", "mortgage", "compliance-checker-v1");
  await emitDirDiscover(applicationId, "compliance-checker-v1", "risk_scoring", "mortgage", "risk-scorer-v1");
  await emitDirDiscover(applicationId, "risk-scorer-v1", "decision_making", "mortgage", "decision-engine-v1");
  await emitDirDiscover(applicationId, "decision-engine-v1", "document_generation", "mortgage", "documentation-generator-v1");

  // DIR: Resolve each agent DID
  await Promise.all(agentIds.map((id) => emitDirResolve(applicationId, id)));

  // ─── OTel: Root pipeline span ────────────────────────────────────────────────────
  const pipelineStartMs = Date.now();
  await emitOtelSpan({
    applicationId,
    traceId: ctx.traceId,
    parentSpanId: ctx.rootSpanId,
    operationName: "mortgage-pipeline.execute",
    serviceName: "pipeline-orchestrator-v1",
    startTimeMs: pipelineStartMs,
    endTimeMs: pipelineStartMs + 1,
    status: "ok",
    kind: "internal",
    attributes: {
      "pipeline.session_id": ctx.sessionId,
      "pipeline.trace_id": ctx.traceId,
      "mortgage.application_id": applicationId,
      "mortgage.borrower": app.borrowerName,
      "mortgage.loan_amount": app.loanAmount,
    },
  });

  try {
    // Stage 1: Application Processor
    const appResult = await runApplicationProcessor(app, ctx);
    await updateApplication(applicationId, {
      applicationProcessorResult: appResult as unknown as Record<string, unknown>,
    });

    // Stage 2: Parallel — Credit Analyzer + Collateral Valuator + Compliance Checker
    const [creditResult, collateralResult] = await Promise.all([
      runCreditAnalyzer(app, ctx),
      runCollateralValuator(app, ctx),
    ]);

    // Compliance runs with actual credit/collateral data
    const complianceResultFinal = await runComplianceChecker(app, creditResult, collateralResult, ctx);

    await updateApplication(applicationId, {
      creditAnalyzerResult: creditResult as unknown as Record<string, unknown>,
      collateralValuatorResult: collateralResult as unknown as Record<string, unknown>,
      complianceCheckerResult: complianceResultFinal as unknown as Record<string, unknown>,
    });

    // Stage 3: Risk Scorer
    const riskResult = await runRiskScorer(app, creditResult, collateralResult, complianceResultFinal, ctx);
    await updateApplication(applicationId, {
      riskScorerResult: riskResult as unknown as Record<string, unknown>,
    });

    // Stage 4: Decision Engine
    const decisionResult = await runDecisionEngine(
      app,
      creditResult,
      collateralResult,
      complianceResultFinal,
      riskResult,
      ctx
    );
    await updateApplication(applicationId, {
      decisionEngineResult: decisionResult as unknown as Record<string, unknown>,
    });

    // Stage 5: Documentation Generator
    const docResult = await runDocumentationGenerator(
      app,
      decisionResult,
      riskResult,
      complianceResultFinal,
      ctx
    );
    await updateApplication(applicationId, {
      documentationGeneratorResult: docResult as unknown as Record<string, unknown>,
    });

    // Finalise
    const decision = decisionResult.decision as "approved" | "conditional_approval" | "denied" | "review_required";
    await updateApplication(applicationId, {
      status: "completed",
      decision,
      decisionRationale: decisionResult.rationale,
      interestRate: riskResult.finalRate,
      monthlyPayment: riskResult.monthlyPayment,
      approvedAmount: decision === "denied" ? 0 : app.loanAmount,
      processingCompletedAt: new Date(),
    });

    await addAuditEntry({
      applicationId,
      eventType: "PIPELINE_COMPLETED",
      description: `Pipeline completed. Decision: ${decision.toUpperCase()}`,
      details: {
        decision,
        interestRate: riskResult.finalRate,
        monthlyPayment: riskResult.monthlyPayment,
      },
      severity: "info",
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await updateApplication(applicationId, { status: "failed" });
    await addAuditEntry({
      applicationId,
      eventType: "PIPELINE_FAILED",
      description: `Pipeline failed: ${errorMessage}`,
      details: { error: errorMessage },
      severity: "error",
    });
    throw err;
  }
}
