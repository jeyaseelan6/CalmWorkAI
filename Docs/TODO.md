# CalmWork AI — Implementation Master TODO List

**Status:** Phase 1 Foundation Completed ✓  
**Framework:** 6 FDE Work Cycles (Step 1: Understand Business Reality → Step 2: Define Right Problem → Step 3: Design AI Approach → Step 4: Build Within Constraints → Step 5: Deploy Into Production → Step 6: Own Outcomes & Improve)  
**Architecture:** Next.js 16 + TypeScript (Frontend) | Python + FastAPI (Backend) | PostgreSQL (Cloud SQL / SQLite dev) | Gemini via Vertex AI | Google Cloud DLP (`backend/app/privacy/`)  

---

## 📌 Phase 1: Project Foundation & Core Infrastructure (COMPLETED ✓)

- [x] **1.1 Monorepo & Directory Setup**
  - [x] Setup `frontend/` (Next.js 16 App Router, TypeScript, Tailwind CSS, lucide-react)
  - [x] Setup `backend/` (Python 3.11+, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy)
- [x] **1.2 AI Input Privacy Guardrail Module (`backend/app/privacy/`)**
  - [x] Implement `detector.py` (Cloud DLP API integration & regex for PII, emails, phones, customer IDs, tokens)
  - [x] Implement `anonymizer.py` (Stable reference token replacement: `[PERSON_001]`, `[CUSTOMER_001]`)
  - [x] Implement `reference_manager.py` (Ephemeral context-isolated reference mappings)
  - [x] Implement `policy.py` (Pre-LLM gatekeeping, payload validation, error fallback)
  - [x] Unit test suite (`backend/tests/unit/test_privacy.py` — ALL TESTS PASSING)
- [x] **1.3 Database Setup & Schema Models**
  - [x] Setup SQLAlchemy models (`engagements`, `outcomes`, `timeline_events`, `approvals`)
  - [x] Configure database engine & SQLite local dev fallback
- [x] **1.4 Backend Core Architecture & REST APIs**
  - [x] Configure FastAPI app shell (`app/main.py`, CORS middleware, OpenAPI schemas)
  - [x] Implement `GET /health`, `GET /api/v1/engagements`, `GET /api/v1/engagements/{id}`
- [x] **1.5 Frontend Application Shell & UI Components**
  - [x] Build global layout shell (`AppShell.tsx` with FDE vs Manager role switcher & Privacy Guardrail badge)
  - [x] Build `OutcomeCard.tsx` (Current outcome statement, versioning, progress bar, DoD checklist)
  - [x] Build signature `ChangeImpactCard.tsx` (**Evidence → Reasoning → Recommendation** layout pattern & approval controls)
  - [x] Assemble `My Work Cockpit` dashboard in `frontend/src/app/page.tsx`
  - [x] Next.js production build compiled cleanly (`npm run build` PASSING)
- [x] **1.6 Seed Data Script**
  - [x] Create and execute seed script `backend/app/db/seed.py` for Acme Corp onboarding + SSO scenario

---

## 📌 Phase 2: UNDERSTAND Agent & Change Impact Analysis (COMPLETED ✓)

- [x] **2.1 Outcome Data Model & Immutable Versioning (`backend/app/services/outcome_service.py`)**
  - [x] Implement transactional outcome versioning (preserving historical v1 DoD definitions)
- [x] **2.2 UNDERSTAND Agent & Pre-LLM Guardrail (`backend/app/agents/understand_agent.py`)**
  - [x] Integrate with `PrivacyPolicyEngine` for pre-boundary PII/secret anonymization
  - [x] Schema validation for structured output (`ChangeImpactAnalysis`)
- [x] **2.3 Change Impact Analysis Engine & REST API**
  - [x] Build multi-dimensional impact propagation engine (Outcome → Requirement → DoD → Work → Dependency → Timeline → Comms)
  - [x] Implement `POST /api/v1/engagements/{id}/analyze-change`, `GET /outcomes/history`, `POST /approvals/respond`
- [x] **2.4 Live Frontend Integration (`frontend/src/app/page.tsx`)**
  - [x] Connected Cockpit dashboard to live FastAPI REST API with real-time sync & Manager Approval state transitions

---

## 📌 Phase 3: KNOW Agent & Grounded RAG Pipeline (COMPLETED ✓)

- [x] **3.1 Document Ingestion & Chunking Engine (`backend/app/knowledge/ingestion.py`)**
  - [x] Overlapping text chunking with pre-LLM Privacy Guardrail PII/secret anonymization
- [x] **3.2 Tenant-Isolated Vector Store (`backend/app/knowledge/vector_store.py`)**
  - [x] Multi-tenant vector index partitioned by `engagement_id` with cosine similarity retrieval
- [x] **3.3 KNOW Agent & Grounded Q&A Engine (`backend/app/agents/know_agent.py`)**
  - [x] Grounded Q&A engine enforcing strict engagement isolation, explicit citations, and Privacy Guardrail output restoration
  - [x] Implement REST APIs: `POST /documents/ingest`, `POST /knowledge/query`
- [x] **3.4 Knowledge UI Component (`frontend/src/components/knowledge/KnowledgePanel.tsx`)**
  - [x] Added KNOW Agent Grounded Q&A panel into the cockpit dashboard with source citations and confidence badges

---

## 📌 Phase 4: MOVE Agent & Next Best Action (COMPLETED ✓)

- [x] **4.1 Blocker & Dependency Reasoning Engine (`backend/app/agents/move_agent.py`)**
  - [x] Backend logic evaluating active blockers, gating criteria, and outcome velocity across 6 FDE Work Cycles
  - [x] Pre-LLM Privacy Guardrail anonymization on blocker descriptions and Next Best Action statements
- [x] **4.2 Next Best Action Algorithm (`backend/app/agents/move_agent.py`)**
  - [x] Dynamic priority ranking (`CRITICAL`, `HIGH_PRIORITY`, `MEDIUM_PRIORITY`, `ROUTINE`) with explicit 'Why Now' justification
- [x] **4.3 MOVE Agent REST API (`backend/app/main.py`)**
  - [x] Endpoint `GET /api/v1/engagements/{id}/next-action` returning ranked Next Best Action payload
- [x] **4.4 Next Best Action UI Integration (`frontend/src/app/page.tsx`)**
  - [x] Integrated live Next Best Action card into cockpit dashboard with dynamic priority badges and real-time reasoning

---

## 📌 Phase 5: DELIVER Agent & Customer Communication (COMPLETED ✓)

- [x] **5.1 Executive Business Language Translation Engine (`backend/app/agents/deliver_agent.py`)**
  - [x] Translates technical engineering progress and completed DoD checklist items into executive business updates
  - [x] Pre-LLM Privacy Guardrail anonymization on raw customer notes and progress milestones
- [x] **5.2 DELIVER Agent REST API (`backend/app/main.py`)**
  - [x] Endpoint `POST /api/v1/engagements/{id}/customer-updates/generate` returning executive update drafts
- [x] **5.3 Customer Communication UI Studio (`frontend/src/components/delivery/CustomerUpdatePanel.tsx`)**
  - [x] Interactive customer update preview, note input, manager approval state, and export/reset controls

---

## 📌 Phase 6: SUPERVISOR Orchestration (COMPLETED ✓)

- [x] **6.1 EventBus Engine (`backend/app/supervisor/event_bus.py`)**
  - [x] Centralized event routing and logging mechanism dispatches events to agent listeners
- [x] **6.2 Supervisor Coordinator Engine (`backend/app/supervisor/coordinator.py`)**
  - [x] Multi-agent orchestrator coordinating UNDERSTAND, KNOW, MOVE, and DELIVER over 1 centralized engagement state across 6 FDE Work Cycles
- [x] **6.3 Supervisor REST API (`backend/app/main.py`)**
  - [x] Endpoint `GET /api/v1/engagements/{id}/supervisor/summary` returning 360-degree multi-agent status summary
- [x] **6.4 Supervisor Dashboard UI (`frontend/src/components/supervisor/SupervisorCard.tsx`)**
  - [x] Interactive 4-Agent Orchestration Card embedded at top of cockpit dashboard with AI Privacy Guardrail verification badge

---

## 📌 Phase 7: Quality, Security & AI Testing

- [ ] **7.1 Privacy Guardrail Test Suite**
  - [ ] Unit & integration tests for entity detection, anonymization, and log scrubbing
- [ ] **7.2 Domain & API Test Suite**
  - [ ] Unit, integration, and system tests for end-to-end Change Impact flow

---

## 📌 Phase 8: Cloud Deployment

- [ ] **8.1 Google Cloud Infrastructure Provisioning**
  - [ ] Deploy backend to Cloud Run, database to Cloud SQL, frontend to Firebase/Cloud
