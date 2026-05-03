# AGNTCY Mortgage Underwriting Demo

> **An AI-powered mortgage loan origination platform demonstrating the [AGNTCY](https://github.com/agntcy) multi-agent framework — featuring real-time pipeline orchestration, SLIM inter-agent messaging, OpenTelemetry distributed tracing, and OASF-compliant agent discovery.**

---

## Overview

This demo showcases the power of the AGNTCY "Internet of Agents" framework applied to one of the most complex workflows in financial services: **mortgage loan underwriting**. A loan application flows through a seven-agent pipeline — each agent a specialised AI reasoner — coordinated by a LangGraph-style orchestrator, communicating over the SLIM protocol, discoverable via the Agent Directory, and fully observable through OpenTelemetry-compatible tracing.

The platform is built as a production-quality web application with a real database, live LLM calls, and a complete audit trail. Every design decision prioritises **explainability** — the audience can see not just the final decision, but every inter-agent message, every reasoning step, and every compliance check that led to it.

---

## AGNTCY Framework Components Demonstrated

The AGNTCY framework defines four core capabilities: **Discover**, **Compose**, **Deploy**, and **Evaluate**. This demo exercises all four.

| AGNTCY Capability | How It Is Demonstrated |
|-------------------|------------------------|
| **Discover** | Agent Directory panel shows all seven agents registered with full OASF capability schemas. The DIR Announce → Discover → Resolve sequence is visualised per pipeline run. |
| **Compose** | LangGraph-style orchestration: Application Processor feeds three parallel agents (Credit Analyzer, Collateral Valuator, Compliance Checker), whose outputs converge into Risk Scorer → Decision Engine → Documentation Generator. |
| **Deploy** | Each agent runs as an independent service with its own DID identifier, OASF schema, execution mode, and SLA definition. |
| **Evaluate** | OpenTelemetry waterfall trace view shows per-agent span durations, latency, token counts, and error states. Dashboard aggregates approval rate, processing time, and compliance pass rate across all runs. |

### SLIM Protocol (Secure Low-Latency Interactive Messaging)

Every inter-agent communication is modelled as a full SLIM envelope, persisted to the database, and displayed in the **SLIM Message Bus** tab on each application. Each envelope includes:

- **DID routing** — `did:agntcy:mortgage-demo/...` source and destination identifiers
- **Message pattern** — `request-reply` or `pub-sub`
- **MLS encryption flag** — marks whether the payload is encrypted in transit
- **Identity verification** — whether the sending agent's DID has been resolved and verified
- **Payload schema** — OASF-aligned schema name (e.g. `agntcy.mortgage.credit-analyzer.request`)
- **Payload preview** — first 300 characters of the JSON payload
- **Per-hop latency** — measured in milliseconds

### OASF (Open Agent Schema Format)

Each agent is registered in the Agent Directory with a full OASF record covering:

```
oasf_version, agent_type, execution_mode, pipeline_stage,
capabilities[], input_schema, output_schema, sla_ms, auth_required
```

### OpenTelemetry Distributed Tracing

The pipeline emits OTel-compatible spans for every agent execution. The **OTel Trace** tab renders a waterfall timeline showing:

- Trace ID and span hierarchy (root pipeline span → per-agent child spans)
- Start time, end time, and duration per agent
- Attributes: agent ID, SLIM channel, LLM model, input/output token estimates
- Events: `agent.started`, `llm.request.sent`, `llm.response.received`, `agent.completed`

---

## Agent Pipeline Architecture

```
                    ┌─────────────────────────┐
                    │   Application Processor  │  Stage 1
                    │   (validate & normalise) │
                    └────────────┬────────────┘
                                 │ SLIM: stage-1 → stage-2-parallel
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                   ▼
   ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
   │  Credit Analyzer │ │Collateral Valuator│ │Compliance Checker│  Stage 2 (parallel)
   │  (creditworthi-  │ │ (LTV, property   │ │ (Fair Lending,   │
   │   ness, DTI)     │ │  market risk)    │ │  BSA/AML, regs)  │
   └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
            └──────────────────┬─┘──────────────────┘
                               │ SLIM: stage-2 → stage-3
                    ┌──────────▼──────────┐
                    │     Risk Scorer      │  Stage 3
                    │ (composite score,    │
                    │  interest rate)      │
                    └──────────┬──────────┘
                               │ SLIM: stage-3 → stage-4
                    ┌──────────▼──────────┐
                    │   Decision Engine    │  Stage 4
                    │ (final underwriting  │
                    │  verdict)            │
                    └──────────┬──────────┘
                               │ SLIM: stage-4 → stage-5
                    ┌──────────▼──────────┐
                    │Documentation Generator│  Stage 5
                    │ (document checklist, │
                    │  disclosures)        │
                    └─────────────────────┘
```

Each arrow represents a **SLIM message** with a full protocol envelope. The three Stage 2 agents run in parallel using `Promise.all()`, mirroring LangGraph's parallel node execution model.

---

## AI/ML Stack

### Machine Learning Models

Two real ML models are trained on publicly available mortgage data and run as a dedicated inference service alongside the main pipeline:

| Model | Type | Training Data | Task | Performance |
|-------|------|--------------|------|-------------|
| **XGBoost Credit Risk** | Gradient Boosted Trees | 50,000 synthetic mortgage records (Kaggle) | Binary default prediction (PD score 0–100) | AUC 0.786, Accuracy 72% |
| **GNN Fraud Detector** | Graph Convolutional Network (2-layer GCN) | Borrower-property-employer graph (50K nodes, 150K edges) | Fraud ring / anomaly detection (fraud score 0–100) | AUC 0.868, Fraud recall 91% |

**XGBoost top features** (by SHAP importance): credit score, employment years, DTI ratio, LTV ratio, geographic risk index, annual income.

**GNN architecture**: 2-layer Graph Convolutional Network with ReLU activations, trained on a heterogeneous graph connecting borrowers to properties and employers. Captures network-level fraud signals (shared addresses, employer clusters, co-borrower rings) that tabular models miss.

Both models are served via a **FastAPI inference server** (`http://localhost:8001`) and called from the Node.js pipeline via HTTP. The Credit Analyzer agent calls XGBoost for the PD score; the Compliance Checker calls the GNN for fraud risk; the Risk Scorer incorporates both scores into the composite risk calculation.

### LLM Layer

| Component | Technology | Details |
|-----------|-----------|----------|
| **Default LLM** | Google Gemini 2.5 Flash | Configurable via Settings — see LLM Provider Switcher below |
| **Orchestration pattern** | LangGraph-style | Sequential stages with parallel fan-out at Stage 2 |
| **Output format** | Structured JSON | Every agent response is a strictly typed JSON object via `response_format: json_schema` |
| **Pre-LLM calculations** | Deterministic | DTI ratio, LTV ratio, and monthly payment computed mathematically before LLM call |
| **Regulatory thresholds** | Hardcoded rules | Industry-standard limits: LTV max 97%, DTI max 43% (QM), credit score min 620 |
| **Interest rate model** | Rule-based tiers | Base rate 6.75% (30-year fixed); five risk tiers adjust ±0.5% to ±1.75% |

### LLM Provider Switcher

The **Settings** page allows switching the LLM provider at runtime without redeployment. Supported providers:

| Provider | Models | Use Case |
|----------|--------|----------|
| **Google Gemini** | Gemini 2.5 Flash/Pro, 2.0 Flash, 1.5 series | Gemini API with your own key |
| **OpenAI** | GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-3.5 | OpenAI API with your own key |
| **Anthropic** | Claude Opus 4.5, Sonnet 4.5, Claude 3.5 series | Anthropic API with your own key |
| **Ollama (Local)** | Llama 3.2, Mistral, Mixtral, Phi-3, Qwen 2.5, DeepSeek-R1, Gemma 2, etc. | **Zero cost, full privacy** — runs entirely on your machine |

The Settings page also shows real-time ML inference server health (XGBoost and GNN model load status).

### What the LLM Reasons About

The LLM is not used as a black box. Each agent receives a **system prompt** defining its role and the regulatory framework it operates under, and a **user prompt** containing the structured input data plus ML model scores. The LLM returns a **strictly typed JSON response** — no parsing of free text occurs anywhere in the pipeline.

| Agent | ML Input | LLM Reasoning Task |
|-------|----------|-------------------|
| Application Processor | — | Completeness assessment, field validation, profile normalisation |
| Credit Analyzer | **XGBoost PD score** | Credit rating assignment, risk factor identification, recommendation |
| Collateral Valuator | — | Property quality assessment, market condition evaluation |
| Compliance Checker | **GNN fraud score** | Fair Lending disparate impact analysis, BSA/AML pattern screening, regulatory limit evaluation |
| Risk Scorer | XGBoost + GNN scores | Weighted composite risk score, tier assignment, pricing rationale |
| Decision Engine | — | Synthesis of all prior outputs into a final verdict with key factors and conditions |
| Documentation Generator | — | Required document checklist and regulatory disclosure text |

---

## Features

### 1. Interactive Mortgage Application Form
A multi-section form collecting borrower information, employment details, loan specifics, and property data. Validates inputs client-side before submission.

### 2. Real-Time Pipeline Visualization
The application detail page polls for live agent status updates, showing each agent card transitioning through `queued → running → completed` (or `failed`) states with live duration timers.

### 3. Decision Output Panel
Full explainability view showing:
- **Verdict**: Approved / Conditional Approval / Denied
- **Key decision factors** with positive/negative/neutral impact ratings
- **Assigned interest rate** and monthly payment
- **Conditions** attached to conditional approvals
- **Confidence level** from the Decision Engine

### 4. Compliance Report
Dedicated tab covering:
- Fair Lending (ECOA, Fair Housing Act) assessment
- BSA/AML screening result (Clear / Review / Flag)
- Regulatory limit checks (LTV, DTI, credit score thresholds)
- Required TRID, RESPA, and TILA disclosures
- Any regulatory violations identified

### 5. SLIM Message Bus
Live scrolling feed of all inter-agent SLIM protocol envelopes for a given pipeline run. Each message is expandable to show the full envelope including DID routing, encryption status, payload schema, and latency.

### 6. OpenTelemetry Trace Waterfall
Distributed trace view with span hierarchy, per-agent duration bars, and expandable attribute/event detail — structured identically to what a real OTel collector would receive.

### 7. Agent Discovery Flow
Visualisation of the DIR announce → discover → resolve sequence, showing which agent queried for which OASF capability, match count, and DID identity verification status.

### 8. Complete Audit Trail
Every agent event is logged with timestamp, inputs, outputs, and decision rationale. The audit trail tab shows a chronological timeline of the full pipeline execution.

### 9. AGNTCY Agent Directory
Lists all seven registered agents with their OASF capability definitions, DID identifiers, execution mode, SLA, and active status.

### 10. Pre-Built Test Scenarios
Five one-click demo scenarios launchable from the Test Scenarios page:

| Scenario | Borrower Profile | Expected Decision |
|----------|-----------------|-------------------|
| **Prime Borrower** | Credit 780, income $185K, DTI 18%, LTV 80% | Approved |
| **Good Borrower** | Credit 718, income $92K, DTI 32%, LTV 90% | Conditional Approval |
| **Denied** | Credit 598, income $38K, DTI 58%, LTV 97%, part-time | Denied |
| **Compliance Trigger** | Self-employed, international trading, $750K Miami condo | BSA/AML Review |
| **Complex Application** | Self-employed co-borrowers, Malibu property, high income/debt | Conditional Approval |

### 11. Dashboard Metrics
Aggregated performance statistics across all completed runs: approval rate, average processing time, average interest rate, compliance pass rate, and decision distribution chart.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| **Backend** | Node.js, Express 4, tRPC 11 |
| **Database** | MySQL (TiDB-compatible) via Drizzle ORM |
| **LLM** | Configurable: Gemini (default), OpenAI, Anthropic, Ollama |
| **ML Models** | XGBoost (credit risk) + GNN/GCN (fraud detection) via FastAPI |
| **Auth** | OAuth 2.0 (JWT session cookies) |
| **Build** | Vite 7, esbuild, tsx |
| **Testing** | Vitest (13 tests) |

### Database Schema

Seven tables power the platform:

| Table | Purpose |
|-------|---------|
| `users` | Authentication and session management |
| `applications` | Full mortgage application data and pipeline results |
| `agent_events` | Per-agent execution records (status, inputs, outputs, duration) |
| `audit_trail` | Chronological event log for every pipeline action |
| `slim_messages` | SLIM protocol envelopes for all inter-agent communications |
| `otel_spans` | OpenTelemetry-compatible distributed trace spans |
| `dir_events` | Agent Directory announce/discover/resolve events |
| `llm_settings` | Active LLM provider configuration (provider, model, API key, temperature) |

---

## Project Structure

```
agntcy-mortgage-demo/
├── client/
│   └── src/
│       ├── components/
│       │   ├── AgentDiscoveryFlow.tsx   # DIR event visualisation
│       │   ├── DashboardLayout.tsx      # Sidebar navigation shell
│       │   ├── OtelTraceWaterfall.tsx   # Distributed trace view
│       │   └── SlimMessageBus.tsx       # SLIM message feed
│       └── pages/
│           ├── AgentDirectory.tsx       # OASF agent registry view
│           ├── ApplicationDetail.tsx    # Pipeline + protocol tabs
│           ├── Applications.tsx         # Application list
│           ├── Apply.tsx                # Loan application form
│           ├── Home.tsx                 # Dashboard metrics
│           └── Scenarios.tsx            # One-click test scenarios
├── drizzle/
│   └── schema.ts                        # All 7 database tables
├── server/
│   ├── agents/
│   │   ├── mlClient.ts                  # XGBoost + GNN inference client
│   │   ├── pipeline.ts                  # 7-agent LLM orchestration
│   │   ├── protocolEmitter.ts           # SLIM / OTel / DIR event emission
│   │   ├── registry.ts                  # OASF agent definitions
│   │   └── scenarios.ts                 # Pre-built test scenario data
│   ├── db.ts                            # Database query helpers
│   ├── llmProvider.ts                   # Multi-provider LLM abstraction layer
│   ├── mortgage.test.ts                 # Vitest test suite
│   └── routers.ts                       # tRPC API procedures
├── ml_training/
│   ├── train_models.py                  # XGBoost + GNN training script
│   └── inference_server.py              # FastAPI ML inference server
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- MySQL-compatible database (TiDB Cloud free tier works)

### Environment Variables

The following environment variables are required:

```bash
DATABASE_URL=          # MySQL connection string
JWT_SECRET=            # Session cookie signing secret (any random secret)

# LLM provider — set one depending on your chosen provider:
GEMINI_API_KEY=        # Google Gemini API key (https://aistudio.google.com)
OPENAI_API_KEY=        # OpenAI API key (https://platform.openai.com)
ANTHROPIC_API_KEY=     # Anthropic API key (https://console.anthropic.com)
OLLAMA_BASE_URL=       # Ollama base URL if running locally (default: http://localhost:11434)
```

> **Tip:** If you use Ollama locally, no cloud API key is required. Run `ollama pull llama3.2` to download a model, then set `OLLAMA_BASE_URL=http://localhost:11434` and configure the provider via the Settings page.

### Installation

```bash
# Clone the repository
git clone https://github.com/agntcy/agntcy-mortgage-demo.git
cd agntcy-mortgage-demo

# Install dependencies
pnpm install

# Push database schema
pnpm db:push

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Starting the ML Inference Server

The XGBoost and GNN models run as a separate FastAPI service. Start it alongside the main app:

```bash
# Install Python dependencies (first time only)
pip install fastapi uvicorn xgboost scikit-learn torch torch-geometric numpy

# Train the models (first time only, ~2 minutes)
cd ml_training
python train_models.py

# Start the inference server (port 8001)
python inference_server.py
```

The inference server runs at `http://localhost:8001`. If it is not running, the pipeline will fall back to rule-based credit scoring and fraud detection — the application will still function, but ML scores will not be available.

> **Health check:** `curl http://localhost:8001/health` returns `{"status": "ok", "xgboost": true, "gnn": true}` when both models are loaded.

### Running Tests

```bash
pnpm test
```

All 13 tests cover: agent registry integrity, scenario data validation, pipeline input/output types, compliance rule logic, risk tier calculations, and tRPC procedure contracts.

---

## Demo Walkthrough

The recommended demo flow for a live audience:

1. **Start at the Dashboard** — show the metrics panel and explain the platform's purpose.
2. **Go to Test Scenarios** — click **Run Scenario** on "Prime Borrower" to launch a live pipeline run.
3. **Watch the Pipeline** — observe each agent card transition in real time on the Application Detail page.
4. **Review the Decision** — open the Decision tab to show the full explainability panel with key factors and interest rate.
5. **Explore SLIM Messages** — switch to the SLIM Messages tab and expand a message envelope to show the full AGNTCY protocol layer.
6. **Open the OTel Trace** — show the waterfall timeline to demonstrate observability across the distributed agent system.
7. **Check Agent Discovery** — show the DIR announce/discover/resolve sequence to explain how agents find each other.
8. **Run Compliance Trigger** — return to Scenarios and run the "Compliance Trigger" case to show the BSA/AML escalation pathway.
9. **Visit Agent Directory** — show the OASF capability definitions for all seven registered agents.
10. **Open Settings** — demonstrate the LLM provider switcher; switch to Ollama to show how the demo runs entirely locally at zero cost.

---

## AGNTCY Framework References

| Resource | URL |
|----------|-----|
| AGNTCY GitHub Organisation | https://github.com/agntcy |
| AGNTCY Documentation | https://docs.agntcy.org |
| SLIM Protocol Specification | https://github.com/agntcy/slim-spec |
| SLIM Implementation | https://github.com/agntcy/slim |
| OASF (Open Agent Schema Format) | https://github.com/agntcy/oasf |
| Agent Directory Specification | https://github.com/agntcy/dir-spec |
| CoffeeAgntcy Reference Implementation | https://github.com/agntcy/CoffeeAgntcy |

---

## Design

The visual design follows the **International Typographic Style** — a pristine white canvas with bold red square accents, crisp black sans-serif typography (Inter), and a strict asymmetric grid. Fine black divider lines and generous negative space define the visual hierarchy, delivering a functional aesthetic grounded in mathematical precision.

---

## Disclaimer

This is a demonstration platform. The BSA/AML screening, property valuation, and Fair Lending assessments are simulated by the LLM and do not constitute real compliance checks. The SLIM, DIR, and OTel components are faithfully emulated to illustrate the AGNTCY protocol layer but are not connected to live AGNTCY infrastructure. This platform should not be used for actual mortgage underwriting decisions.

---

## License

This project is released under the [Apache 2.0 License](LICENSE).
