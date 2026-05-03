/**
 * AGNTCY Mortgage Demo — ML Inference Client
 * ============================================
 * Calls the Python FastAPI ML inference server (port 8001).
 * Provides XGBoost credit risk and GNN fraud detection predictions.
 */

const ML_SERVER_URL = process.env.ML_SERVER_URL || "http://localhost:8001";

export interface CreditRiskInput {
  credit_score: number;
  annual_income: number;
  loan_amount: number;
  property_value: number;
  down_payment: number;
  ltv_ratio: number;
  dti_ratio: number;
  existing_debts_monthly: number;
  years_employed: number;
  employment_type: number; // 0=full-time, 1=part-time, 2=self-employed, 3=contract
  loan_term_months: number;
  loan_purpose: number; // 0=purchase, 1=refinance, 2=cash-out
  property_type: number; // 0=single, 1=condo, 2=townhouse, 3=multi
  property_age: number;
  borrower_age: number;
  geo_risk: number; // 0=low, 1=medium, 2=high
}

export interface CreditRiskResult {
  model: string;
  default_probability: number;
  risk_tier: string;
  risk_label: string;
  recommendation: string;
  top_risk_factors: Array<{ feature: string; importance: number; value: number | null }>;
  model_auc: number;
  training_samples: number;
}

export interface FraudRiskInput {
  credit_score_norm: number;
  dti_norm: number;
  ltv_norm: number;
  income_norm: number;
  emp_years_norm: number;
  shared_employer_count: number;
  peer_features?: number[][];
}

export interface FraudRiskResult {
  model: string;
  fraud_probability: number;
  fraud_risk: string;
  network_flag: string;
  network_anomalies: string[];
  peer_applications_analyzed: number;
  model_auc: number;
  model_fraud_recall: number;
}

export interface MLServerHealth {
  status: string;
  xgboost_loaded: boolean;
  gnn_loaded: boolean;
}

async function callML<T>(endpoint: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${ML_SERVER_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[ML] ${endpoint} returned ${res.status}: ${text}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[ML] ${endpoint} failed: ${err}`);
    return null;
  }
}

export async function checkMLHealth(): Promise<MLServerHealth | null> {
  try {
    const res = await fetch(`${ML_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as MLServerHealth;
  } catch {
    return null;
  }
}

/**
 * Map application data to XGBoost feature vector.
 * Employment type mapping: full-time=0, part-time=1, self-employed=2, contract=3
 */
export function buildCreditRiskInput(app: {
  creditScore: number;
  annualIncome: number;
  loanAmount: number;
  propertyValue: number;
  downPayment: number;
  ltvRatio: number;
  dtiRatio: number;
  monthlyDebts: number;
  yearsEmployed: number;
  employmentType: string;
  loanTermMonths: number;
  loanPurpose: string;
  propertyType: string;
  propertyAge: number;
  borrowerAge: number;
  propertyState?: string;
}): CreditRiskInput {
  const empTypeMap: Record<string, number> = {
    "full-time": 0,
    "part-time": 1,
    "self-employed": 2,
    contract: 3,
    retired: 0,
    other: 0,
  };
  const purposeMap: Record<string, number> = {
    purchase: 0,
    refinance: 1,
    "cash-out": 2,
    "cash-out refinance": 2,
  };
  const propTypeMap: Record<string, number> = {
    "single-family": 0,
    "single family": 0,
    condo: 1,
    townhouse: 2,
    "multi-family": 3,
    "multi family": 3,
  };

  // Geographic risk: high-cost states = medium/high
  const highRiskStates = ["CA", "NY", "FL", "NV", "AZ"];
  const medRiskStates = ["TX", "IL", "GA", "NC", "OH"];
  const state = (app.propertyState || "").toUpperCase();
  const geoRisk = highRiskStates.includes(state) ? 2 : medRiskStates.includes(state) ? 1 : 0;

  return {
    credit_score: app.creditScore,
    annual_income: app.annualIncome,
    loan_amount: app.loanAmount,
    property_value: app.propertyValue,
    down_payment: app.downPayment,
    ltv_ratio: app.ltvRatio,
    dti_ratio: app.dtiRatio,
    existing_debts_monthly: app.monthlyDebts,
    years_employed: app.yearsEmployed,
    employment_type: empTypeMap[app.employmentType.toLowerCase()] ?? 0,
    loan_term_months: app.loanTermMonths,
    loan_purpose: purposeMap[app.loanPurpose.toLowerCase()] ?? 0,
    property_type: propTypeMap[app.propertyType.toLowerCase()] ?? 0,
    property_age: app.propertyAge,
    borrower_age: app.borrowerAge,
    geo_risk: geoRisk,
  };
}

/**
 * Normalize features to [0,1] for GNN input.
 */
export function buildFraudRiskInput(app: {
  creditScore: number;
  dtiRatio: number;
  ltvRatio: number;
  annualIncome: number;
  yearsEmployed: number;
  sharedEmployerCount?: number;
}): FraudRiskInput {
  return {
    credit_score_norm: Math.min(1, Math.max(0, (app.creditScore - 300) / 550)),
    dti_norm: Math.min(1, app.dtiRatio),
    ltv_norm: Math.min(1, app.ltvRatio),
    income_norm: Math.min(1, app.annualIncome / 300000),
    emp_years_norm: Math.min(1, app.yearsEmployed / 20),
    shared_employer_count: app.sharedEmployerCount ?? 0,
  };
}

export async function predictCreditRisk(input: CreditRiskInput): Promise<CreditRiskResult | null> {
  return callML<CreditRiskResult>("/predict/credit-risk", input);
}

export async function predictFraudRisk(input: FraudRiskInput): Promise<FraudRiskResult | null> {
  return callML<FraudRiskResult>("/predict/fraud-risk", input);
}
