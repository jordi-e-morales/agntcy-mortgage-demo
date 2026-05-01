// AGNTCY Agent Directory — OASF capability definitions

export interface OASFAgent {
  id: string;
  name: string;
  description: string;
  version: string;
  framework: string;
  capabilities: string[];
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
  communicationPattern: string;
  status: "active" | "idle" | "error";
  tags: string[];
  oasfMetadata: Record<string, string>;
}

export const AGENT_REGISTRY: OASFAgent[] = [
  {
    id: "application-processor-v1",
    name: "Application Processor",
    description:
      "Extracts, validates, and normalises mortgage loan application data. Performs completeness checks and generates a structured application record for downstream agents.",
    version: "1.0.0",
    framework: "AGNTCY / LangGraph",
    capabilities: [
      "data_extraction",
      "data_validation",
      "data_normalization",
      "completeness_check",
      "schema_mapping",
    ],
    inputSchema: {
      borrower: "object",
      employment: "object",
      loan_request: "object",
      property: "object",
    },
    outputSchema: {
      application_id: "string",
      validated_data: "object",
      data_quality_score: "number",
      missing_fields: "array",
      status: "string",
    },
    communicationPattern: "request-reply",
    status: "active",
    tags: ["intake", "validation", "normalization"],
    oasfMetadata: {
      oasf_version: "1.0",
      agent_type: "processor",
      execution_mode: "sequential",
      pipeline_stage: "1",
      sla_ms: "8000",
      auth_required: "false",
    },
  },
  {
    id: "credit-analyzer-v1",
    name: "Credit Analyzer",
    description:
      "Evaluates borrower creditworthiness by analysing credit score, payment history, debt-to-income ratio, and credit utilisation. Produces a structured credit risk assessment.",
    version: "1.0.0",
    framework: "AGNTCY / LangGraph",
    capabilities: [
      "credit_scoring",
      "credit_history_analysis",
      "dti_calculation",
      "risk_assessment",
      "payment_history_review",
    ],
    inputSchema: {
      credit_score: "number",
      annual_income: "number",
      existing_debts_monthly: "number",
      years_employed: "number",
    },
    outputSchema: {
      credit_rating: "string",
      dti_ratio: "number",
      risk_level: "string",
      risk_factors: "array",
      recommendation: "string",
      confidence_score: "number",
    },
    communicationPattern: "request-reply",
    status: "active",
    tags: ["credit", "risk", "underwriting"],
    oasfMetadata: {
      oasf_version: "1.0",
      agent_type: "analyzer",
      execution_mode: "parallel",
      pipeline_stage: "2",
      sla_ms: "10000",
      auth_required: "false",
    },
  },
  {
    id: "collateral-valuator-v1",
    name: "Collateral Valuator",
    description:
      "Assesses property value using market comparables, location data, and property characteristics. Calculates loan-to-value ratio and identifies collateral risk factors.",
    version: "1.0.0",
    framework: "AGNTCY / LangGraph",
    capabilities: [
      "property_valuation",
      "ltv_calculation",
      "market_analysis",
      "collateral_assessment",
      "comparable_sales_analysis",
    ],
    inputSchema: {
      property_address: "string",
      property_type: "string",
      property_value: "number",
      loan_amount: "number",
      down_payment: "number",
    },
    outputSchema: {
      estimated_value: "number",
      ltv_ratio: "number",
      collateral_quality: "string",
      market_conditions: "string",
      property_risk_factors: "array",
    },
    communicationPattern: "request-reply",
    status: "active",
    tags: ["collateral", "property", "valuation"],
    oasfMetadata: {
      oasf_version: "1.0",
      agent_type: "valuator",
      execution_mode: "parallel",
      pipeline_stage: "2",
      sla_ms: "10000",
      auth_required: "false",
    },
  },
  {
    id: "compliance-checker-v1",
    name: "Compliance Checker",
    description:
      "Verifies regulatory compliance including Fair Lending (ECOA/FHA), BSA/AML screening, TRID disclosure requirements, and regulatory limit validation (LTV, DTI, credit score thresholds).",
    version: "1.0.0",
    framework: "AGNTCY / LangGraph",
    capabilities: [
      "fair_lending_check",
      "bsa_aml_screening",
      "regulatory_validation",
      "disclosure_generation",
      "trid_compliance",
      "ecoa_compliance",
    ],
    inputSchema: {
      borrower: "object",
      loan: "object",
      credit_score: "number",
      ltv_ratio: "number",
      dti_ratio: "number",
    },
    outputSchema: {
      compliance_status: "string",
      fair_lending_assessment: "object",
      bsa_aml_result: "string",
      regulatory_violations: "array",
      required_disclosures: "array",
      approval_allowed: "boolean",
    },
    communicationPattern: "request-reply",
    status: "active",
    tags: ["compliance", "fair-lending", "bsa-aml", "regulatory"],
    oasfMetadata: {
      oasf_version: "1.0",
      agent_type: "compliance",
      execution_mode: "parallel",
      pipeline_stage: "2",
      sla_ms: "12000",
      auth_required: "false",
    },
  },
  {
    id: "risk-scorer-v1",
    name: "Risk Scorer",
    description:
      "Aggregates outputs from Credit Analyzer, Collateral Valuator, and Compliance Checker to compute a composite risk score and determine risk-based pricing.",
    version: "1.0.0",
    framework: "AGNTCY / LangGraph",
    capabilities: [
      "risk_aggregation",
      "composite_scoring",
      "pricing_calculation",
      "risk_tier_assignment",
      "rate_determination",
    ],
    inputSchema: {
      credit_assessment: "object",
      collateral_assessment: "object",
      compliance_assessment: "object",
      loan_profile: "object",
    },
    outputSchema: {
      risk_score: "number",
      risk_tier: "string",
      base_rate: "number",
      rate_adjustment: "number",
      final_rate: "number",
      pricing_rationale: "string",
    },
    communicationPattern: "request-reply",
    status: "active",
    tags: ["risk", "pricing", "scoring"],
    oasfMetadata: {
      oasf_version: "1.0",
      agent_type: "scorer",
      execution_mode: "sequential",
      pipeline_stage: "3",
      sla_ms: "10000",
      auth_required: "false",
    },
  },
  {
    id: "decision-engine-v1",
    name: "Decision Engine",
    description:
      "Makes the final loan approval decision by aggregating all agent assessments. Produces a fully explainable verdict with key decision factors, conditions, and next steps.",
    version: "1.0.0",
    framework: "AGNTCY / LangGraph",
    capabilities: [
      "decision_making",
      "rule_application",
      "explainability",
      "condition_generation",
      "audit_trail_generation",
    ],
    inputSchema: {
      application: "object",
      credit_assessment: "object",
      collateral_assessment: "object",
      compliance_assessment: "object",
      risk_assessment: "object",
    },
    outputSchema: {
      decision: "string",
      rationale: "string",
      key_factors: "array",
      conditions: "array",
      next_steps: "array",
      confidence_level: "number",
    },
    communicationPattern: "request-reply",
    status: "active",
    tags: ["decision", "explainability", "underwriting"],
    oasfMetadata: {
      oasf_version: "1.0",
      agent_type: "decision",
      execution_mode: "sequential",
      pipeline_stage: "4",
      sla_ms: "12000",
      auth_required: "false",
    },
  },
  {
    id: "documentation-generator-v1",
    name: "Documentation Generator",
    description:
      "Generates all required loan documents and regulatory disclosures including Loan Estimate, TILA-RESPA disclosures, Fair Housing notice, and approval/denial letters.",
    version: "1.0.0",
    framework: "AGNTCY / LangGraph",
    capabilities: [
      "document_generation",
      "disclosure_creation",
      "loan_estimate_generation",
      "tila_respa_compliance",
      "letter_generation",
    ],
    inputSchema: {
      application: "object",
      loan_terms: "object",
      decision: "object",
      compliance_requirements: "array",
    },
    outputSchema: {
      documents: "array",
      disclosures: "array",
      decision_letter_summary: "string",
      document_checklist: "array",
    },
    communicationPattern: "fire-and-forget",
    status: "active",
    tags: ["documentation", "disclosures", "tila", "respa"],
    oasfMetadata: {
      oasf_version: "1.0",
      agent_type: "generator",
      execution_mode: "sequential",
      pipeline_stage: "5",
      sla_ms: "10000",
      auth_required: "false",
    },
  },
];

export function getAgentById(id: string): OASFAgent | undefined {
  return AGENT_REGISTRY.find((a) => a.id === id);
}
