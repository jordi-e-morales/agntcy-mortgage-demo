# AGNTCY Mortgage Underwriting Platform — TODO

## Phase 1: Database & Foundation
- [x] Database schema: applications, agent_events, audit_trail, metrics
- [x] Drizzle schema push

## Phase 2: Server / Agent Logic
- [x] LLM agent: Application Processor
- [x] LLM agent: Credit Analyzer
- [x] LLM agent: Collateral Valuator
- [x] LLM agent: Compliance Checker
- [x] LLM agent: Risk Scorer
- [x] LLM agent: Decision Engine
- [x] LLM agent: Documentation Generator
- [x] LangGraph-style orchestration pipeline (parallel + sequential)
- [x] tRPC procedure: submitApplication
- [x] tRPC procedure: getApplication (with full state)
- [x] tRPC procedure: listApplications
- [x] tRPC procedure: getAuditTrail
- [x] tRPC procedure: getDashboardMetrics
- [x] tRPC procedure: getAgentDirectory
- [x] tRPC procedure: runTestScenario (5 scenarios)
- [ ] SSE streaming for real-time agent status updates (polling used instead)

## Phase 3: Frontend — Core Views
- [x] Global layout with sidebar navigation (DashboardLayout)
- [x] International Typographic Style theme (white/red/black)
- [x] Application form (borrower, employment, loan, property)
- [x] Agent pipeline visualization (real-time status per agent)
- [x] Decision output panel (verdict, factors, rate, terms, conditions)

## Phase 4: Frontend — Supporting Views
- [x] Compliance report view (Fair Lending, BSA/AML, regulatory limits, disclosures)
- [x] Audit trail timeline (every agent event, timestamped)
- [x] AGNTCY Agent Directory panel (OASF capabilities, status)
- [x] Dashboard metrics (approval rate, avg time, avg rate, compliance pass rate, per-agent stats)

## Phase 5: Scenarios & Integration
- [x] Pre-built scenario: Prime Borrower
- [x] Pre-built scenario: Good Borrower
- [x] Pre-built scenario: Denied
- [x] Pre-built scenario: Compliance Trigger
- [x] Pre-built scenario: Complex Application
- [x] One-click scenario launch UI
- [x] End-to-end pipeline integration test

## Phase 6: Polish & Delivery
- [x] Vitest unit tests (13 tests passing)
- [x] TypeScript: zero errors
- [x] Checkpoint and publish
