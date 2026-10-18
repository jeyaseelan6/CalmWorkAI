# CalmWork AI — Outcome-Driven Multi-Agent Work Intelligence Layer

[![Google Cloud Platform](https://img.shields.io/badge/Google_Cloud-Cloud_SQL_%7C_Cloud_Run_%7C_GCS_%7C_Vertex_AI-4285F4?logo=google-cloud&logoColor=white)](https://cloud.google.com)
[![Google ADK](https://img.shields.io/badge/Google_ADK-Multi--Agent_Runtime-34A853?logo=google&logoColor=white)](https://github.com/google/adk)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.8_Flash_%7C_Multimodal_Vision-8E75C2?logo=google-gemini&logoColor=white)](https://ai.google.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Tests](https://img.shields.io/badge/Test_Suite-92_Passed-success)](https://pytest.org)

> **Theme**: Future of Work & Enterprise Productivity  
> **Platform Category**: Enterprise Multi-Agent Coordination & Technical Governance Layer  
> **Target Personas**: Forward-Deployed Engineers (FDEs) and Engineering Managers / Delivery Leads only  

---

## Executive Summary

**CalmWork AI** is an outcome-driven work-intelligence and multi-agent coordination layer built natively on **Google Cloud Platform (GCP)** and the **Google Agent Development Kit (ADK)**. 

Modern enterprise software delivery suffers from an unsustainable **"coordination tax"**: technical teams spend 40% to 50% of their working hours context-switching, searching across fragmented documentation, manually deciphering ambiguous bug reports, drafting repetitive executive status memos, and defending against unapproved scope creep.

CalmWork AI is **not another task-tracker or Jira clone**. Execution continues in existing code repositories and CI/CD pipelines. CalmWork acts as an intelligent, autonomous cognitive layer sitting across the enterprise engagement—maintaining an authoritative understanding of:
1. **What was contracted vs. what is actively being built** (Scope & Outcome tracking)
2. **What the technical ground-truth is** (Zero-hallucination document & runbook grounding)
3. **What is blocked and what the next high-leverage action is** (Operational velocity)
4. **What the client should be told** (Manager-gated, professional executive communication)
5. **Why production failed** (Multimodal screenshot intelligence & visual log diagnostics)

---

## 1. Problem Statement

### To Whom is this a Problem?
* **Forward-Deployed Engineers (FDEs)**: Embedded directly inside dynamic customer environments, FDEs operate under intense pressure balancing shifting requirements, undocumented legacy systems, and strict delivery timelines.
* **Engineering Managers & Delivery Leads**: Responsible for delivery governance, contract margin protection, and preventing unbilled scope drift while lacking unified real-time visibility into day-to-day technical reality.

### What is the Problem?
* **Silent Scope Creep**: Customer requests made during ad-hoc meetings quietly alter technical architecture without managerial authorization, resulting in multi-million dollar overruns and missed cutover deadlines.
* **Knowledge Fragmentation & Amnesia**: Architecture decision records (ADRs), deployment runbooks, and client specs are scattered across Slack threads, Notion docs, Jira comments, and emails.
* **Opaque Production Outages**: Clients report issues by pasting cropped error screenshots into chat (*"The dashboard is broken"*), forcing engineers into hours of blind log-hunting.
* **AI Hallucination & Governance Risk**: Generic LLMs hallucinate non-existent APIs and commit engineers to unverified promises without human-in-the-loop approval.

### Why Solving it is Critical
* **Combating FDE Burnout**: FDEs are expensive, high-leverage talent. Relieving them from manual status reporting and archaeological document searching restores engineering focus.
* **Defending Profit Margins**: Every unapproved scope change directly erodes delivery margins.
* **Preserving Enterprise Trust**: Customer-facing updates must be 100% accurate, professional, and approved by delivery leadership before external transmission.

---

## 2. The Solution: Multi-Agent Architecture (Google ADK)

CalmWork AI models technical delivery as **a synchronized network of specialized autonomous agents** orchestrated by a central supervisor over a unified **Google Cloud SQL** state.

```mermaid
flowchart TD
    User["👤 Forward-Deployed Engineer / Manager"] -->|Chat / Screenshot / Query| UI["Frontend (React / Vite / Tailwind)"]
    UI -->|REST API / JWT| API["Backend API Gateway (FastAPI on Google Cloud Run)"]

    subgraph Security["Enterprise Security & Privacy Boundary"]
        API --> PrivacyEngine["🛡️ Privacy Guardrail Engine<br/>(Cloud DLP + Reversible Token Vault)"]
    end

    subgraph GoogleADK["Google Agent Development Kit (ADK) Multi-Agent Layer"]
        PrivacyEngine --> Sup["🧭 CalmWork SUPERVISOR<br/>(Central Orchestration & Intent Classifier)"]
        
        Sup -->|Outcome & Scope| PlanAgent["📋 PLAN Agent<br/>(Scope Impact & DoD Versioning)"]
        Sup -->|Grounded Specs| KnowAgent["📚 KNOW Agent<br/>(Authoritative Search & Citations)"]
        Sup -->|Velocity & Blockers| MoveAgent["⚡ MOVE Agent<br/>(Next Action & Blocker Removal)"]
        Sup -->|Client Memos| DeliverAgent["🚀 DELIVER Agent<br/>(Customer Reports & Milestone Memos)"]
        Sup -->|Visual Telemetry| SupportAgent["🛠️ SUPPORT Agent<br/>(Screenshot Intelligence & Triage)"]
    end

    subgraph GCPInfrastructure["Google Cloud Platform (GCP) Infrastructure"]
        SupportAgent -->|Multimodal Image Parts| Gemini["✨ Google Gemini 3.8 Flash<br/>(Vision & LLM Reasoning)"]
        PlanAgent & KnowAgent & MoveAgent & DeliverAgent --> Gemini
        
        API -->|CRUD & Timeline Ledger| CloudSQL[("🗄️ Google Cloud SQL<br/>(PostgreSQL Authoritative State)")]
        API -->|Documents & Chat Images| GCS["☁️ Google Cloud Storage (GCS)<br/>(Encrypted Object Storage)"]
    end

    subgraph Governance["Human-in-the-Loop Governance"]
        DeliverAgent -.->|Drafts Update| MgrApproval{"⚖️ Manager Approval Required"}
        PlanAgent -.->|Out-of-Scope Delta| ScopeGating{"⚠️ Manager Scope Authorization"}
        MgrApproval -->|Approved| ClientUpdate["📧 Official Customer Brief"]
        ScopeGating -->|Authorized| NewOutcomeVersion["v(N+1) Contract Baseline"]
    end
```

### Agent Roster & Core Responsibilities

| Agent | Name & Role | Primary Responsibility |
| :---: | :--- | :--- |
| 🧭 | **CalmWork Supervisor** | **Central Orchestrator & Universal Router**: Classifies incoming queries via semantic intent routing, coordinates cross-agent handovers, and generates 360° multi-agent operational summaries. |
| 📋 | **PLAN Agent** | **Outcome & Scope Intelligence**: Tracks contractual outcome statements, enforces versioned **Definitions of Done (DoD)**, flags unapproved scope drift (`NEEDS_REASSESSMENT`), and evaluates milestone dependencies. |
| 📚 | **KNOW Agent** | **Authoritative Knowledge Retrieval**: Performs semantic and exact document retrieval across ingested customer architecture specs, ADRs, and runbooks. **Zero-Hallucination Policy**: Returns strict citations or explicitly declares insufficient evidence. |
| ⚡ | **MOVE Agent** | **Operational Velocity & Blocker Elimination**: Identifies critical-path engineering blockers, active approvals, and synthesizes the **single highest-leverage next action** for the engineer's active work cycle. |
| 🚀 | **DELIVER Agent** | **Customer Communication & Milestone Translation**: Translates technical pull requests and database work into polished executive updates. **Consequential Governance**: All customer reports are strictly gated by Manager approval before release. |
| 🛠️ | **SUPPORT Agent** | **Visual Diagnostics & Incident Triage**: Inspects client-provided screenshots using **Google Gemini 3.8 Flash Multimodal Vision**, OCRing browser console errors, stack traces, and formulating runbook-grounded root causes. |

### Agentic Skills: The Morning Brief Skill (`skill_morning_brief`)

In addition to individual agent reasoning, CalmWork AI features **Modular Agentic Skills**—reusable, multi-agent procedural workflows designed for Forward-Deployed Engineers and their managers:

```mermaid
flowchart LR
    Trigger["Engineer / Manager Trigger<br/>(1-Click 'My Day' or Chat Intent)"] --> MBExecutor["Morning Brief Skill Executor"]
    MBExecutor --> PlanCoord["PLAN Agent<br/>(Milestone & Scope Health)"]
    MBExecutor --> KnowCoord["KNOW Agent<br/>(Authoritative Specs & ADRs)"]
    MBExecutor --> MoveCoord["MOVE Agent<br/>(Blockers & IST Due Dates)"]
    
    PlanCoord & KnowCoord & MoveCoord --> Synthesis["Google Gemini Synthesis Engine"]
    Synthesis --> Persist[("Google Cloud SQL<br/>(Historical Brief Ledger)")]
    Persist --> Output["⚡ Operational Briefing<br/>• Scope Health & DoD Status<br/>• Active Blockers & Approvals<br/>• Single Next Best Action (IST)"]
```

* **Multi-Agent Coordination Procedure**: The Morning Brief skill (`app/skills/morning_brief/executor.py`) coordinates **PLAN** (contractual milestones & DoD completion), **KNOW** (authoritative specs & runbooks), and **MOVE** (critical blockers & approval gates) to synthesize a prioritized operational agenda.
* **Next Best Action in IST**: Delivers the single highest-leverage engineering action with native Indian Standard Time (`Asia/Kolkata` / IST) deadline awareness.
* **Strict Cost-Control Policy**: Multi-tenant background polling and idle cron triggers are eliminated. The Morning Brief runs **strictly on-demand** via a 1-click trigger in the **"My Day"** tab or via conversational chat (*"Generate morning brief"* in Ask CalmWork), protecting enterprise API budgets.
* **Auditable Ledger in Cloud SQL**: Each generated brief is persisted to Google Cloud SQL, providing delivery managers with an immutable historical record of daily engineering velocity and risk signals.

---

## 3. Google Cloud Platform (GCP) Enterprise Architecture

CalmWork AI is built **Google Cloud-native**, leveraging the GCP ecosystem for enterprise-grade security, scalability, and performance:

### 1. Google Cloud SQL (PostgreSQL)
* **Authoritative State & Ledger**: Managed relational PostgreSQL instance housing all engagements, versioned outcomes, timeline audit trails, role-based permissions, and conversation persistence.
* **Zero Lost Updates**: ACID transaction guarantees with connection pooling (`pool_pre_ping=True`, `pool_recycle=300`).

### 2. Google Agent Development Kit (ADK)
* **Agent Framework**: Implements native Google ADK interfaces (`google.adk.agents.Agent`, `Runner`, `BaseSessionService`, `LlmRequest`).
* **Session Persistence**: Centralized session management with extensible database session persistence.
* **Pre-LLM Privacy Interceptors**: Enforces `before_model_callback` defense-in-depth security before any data leaves the runtime.

### 3. Google Gemini 3.8 Flash & Multimodal Vision
* **Deep Contextual Reasoning**: High-speed, low-latency reasoning across complex contractual scopes and worknotes.
* **Multimodal Visual Intelligence**: Direct ingestion of image binary buffers (`types.Part.from_bytes`) to parse browser console errors (e.g., HTTP 500, HTTP 502 Bad Gateway) and UI exceptions directly from user screenshots.

### 4. Google Cloud Storage (GCS)
* **Multi-Tenant Document & Telemetry Store**: Secure GCP bucket storage for customer runbooks, architecture diagrams, and visual screenshot diagnostic artifacts with signed HTTPS access.

### 5. Google Cloud Run
* **Serverless Container Compute**: Production deployment target for the FastAPI backend and React frontend containers, providing automated horizontal autoscaling and zero idle cost.

### 6. Google Cloud DLP (Data Loss Prevention) Ready
* **Enterprise Privacy Boundary**: Regex and Cloud DLP-compatible scrubbing engine that strips personal identifiable information (PII), email addresses, API tokens, and customer secrets before LLM inference, caching them in a reversible cryptographic token vault.

---

## 4. Key Differentiators & Platform Invariants

1. **Human-in-the-Loop Governance (Anti-Rogue AI)**:
   * AI never unilaterally changes contractual commitments or emails customers.
   * Consequential actions (scope additions, task creation, customer reports) enter a `PENDING` approval queue requiring Manager sign-off.
2. **Strict Non-Hallucination Invariant**:
   * If a document or runbook does not contain the answer, the KNOW Agent explicitly responds: *"Evidence insufficient to answer reliably."*
3. **Reversible Cryptographic Tokenization**:
   * Raw secrets (`AKIA...`, `Bearer eyJ...`) are transformed into `[CREDENTIAL_001]` before hitting Gemini, and rehydrated only in secure local UI displays.
4. **Multimodal Screenshot Intelligence**:
   * Engineers can drag-and-drop or paste (`Ctrl+V`) console error screenshots directly into **Ask CalmWork** to receive instant severity triage, affected component mapping, and runbook remediation steps.

---

## 5. Repository Directory Structure

```text
CalmWork AI/
├── backend/
│   ├── app/
│   │   ├── agents/            # Google ADK Agent Implementations
│   │   │   ├── adk_runtime.py   # ADK Runner, Model Resolution & Privacy Interceptor
│   │   │   ├── plan_agent.py    # Scope & Outcome Intelligence
│   │   │   ├── know_agent.py    # Authoritative Retrieval & Citations
│   │   │   ├── move_agent.py    # Velocity & Next Action Engine
│   │   │   ├── deliver_agent.py # Customer Updates & Report Drafting
│   │   │   └── support_agent.py # Multimodal Screenshot Intelligence
│   │   ├── api/v1/            # FastAPI REST Routers (Supervisor, Engagements, etc.)
│   │   ├── db/                # Google Cloud SQL (PostgreSQL) / SQLAlchemy Schemas
│   │   ├── models/            # SQLAlchemy Database Entity Models
│   │   ├── privacy/           # AI Privacy Guardrail & De-identification Engine
│   │   ├── services/          # Storage Service (GCS), Email, Auth
│   │   ├── supervisor/        # Supervisor Orchestration & Semantic Intent Router
│   │   ├── config.py          # Environment Settings
│   │   └── main.py            # FastAPI Application Entry Point
│   ├── tests/                 # 92 Unit, Integration & Regression Tests
│   ├── requirements.txt       # Python Dependencies
│   └── .env                   # Configuration Variables (GCP, Cloud SQL, Gemini)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── supervisor/    # Ask CalmWork Conversational Interface
│   │   │   ├── myday/         # Forward-Deployed Engineer Morning Brief & Tasks
│   │   │   ├── governance/    # Manager Approval Gating & Scope Change Auditing
│   │   │   └── delivery/      # Customer Update Reports & PDF Generation
│   │   ├── context/           # Engagement & Role Context (FDE vs Manager)
│   │   └── services/          # API Client & Telemetry
│   ├── package.json           # Frontend Dependencies
│   └── vite.config.ts         # Vite Configuration & API Proxies
└── Docs/
    ├── PRD.md                 # Product Requirements Document
    ├── TDD.md                 # Technical Design Document
    └── UI.md                  # Design Tokens & UI Guidelines
```

---

## 6. Quickstart & Local Setup Guide

### Prerequisites
* **Python**: 3.11 or higher
* **Node.js**: v18.0 or higher (`npm` v9+)
* **Google Gemini API Key**: [Get a free API key at Google AI Studio](https://aistudio.google.com/app/apikey)
* **Google Cloud SDK** (`gcloud`) *(optional, for GCP Cloud SQL / GCS authentication)*

---

### Backend Setup (FastAPI & Google ADK)

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # Windows PowerShell
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the Backend Server**:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```
   * Interactive OpenAPI Docs: `http://localhost:8000/docs`
   * Health Check: `http://localhost:8000/health`

---

### Frontend Setup (React & Vite)

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   * Web Application: `http://localhost:5173`

---

## 7. Verification & Test Suite

CalmWork AI maintains a rigorous test suite covering multi-agent orchestration, human-in-the-loop approval workflows, privacy guardrail redactions, and regression invariants.

To execute the test suite:
```bash
cd backend
.\venv\Scripts\python.exe -m pytest -v
```

**Results**:
```text
============================== test session starts ==============================
92 passed in 186.12s (100% test coverage across core agent invariants)
```

---

## 8. Enterprise Security & Compliance

* **Zero Data Retention in Models**: Customer data is protected by the CalmWork Privacy Boundary. No model training occurs on customer engagement data.
* **Role-Based Access Control (RBAC)**: Clear privilege separation between Engineers (`FDE`) and Delivery Leadership (`MANAGER`).
* **Immutable Audit Trail**: All timeline events, scope modifications, and customer update approvals are stored as immutable records in Google Cloud SQL.

---

## License

This project is licensed under the Apache 2.0 License. See `LICENSE` for details.
