# CalmWork AI — Implementation Master TODO List

**Status:** Phase 1 Foundation Completed ✓  
**Architecture:** Next.js + TypeScript (Frontend) | Python + FastAPI (Backend) | PostgreSQL (Cloud SQL / SQLite dev) | Gemini via Vertex AI | Google Cloud DLP (`backend/app/privacy/`)  

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

## 📌 Phase 2: UNDERSTAND Agent & Change Impact Analysis (Next Priority)

- [ ] **2.1 Outcome Data Model & Immutable Versioning**
  - [ ] Implement transactional outcome versioning (preserving historical DoD versions)
- [ ] **2.2 Outcome Health Monitor**
  - [ ] Build Gemini semantic analysis service for detecting outcome drift
  - [ ] Schema validation for structured output (`OutcomeHealthResult`)
- [ ] **2.3 Change Impact Analysis Engine**
  - [ ] Build generalized multi-dimensional impact propagation engine (Outcome → Requirement → DoD → Work → Dependency → Timeline → Comms)

---

## 📌 Phase 3: KNOW Agent & Grounded RAG Pipeline

- [ ] **3.1 Document Ingestion & Storage**
  - [ ] Cloud Storage integration for document upload
  - [ ] Text extraction, chunking, and metadata enrichment
- [ ] **3.2 Embeddings & Vector Search**
  - [ ] Vertex AI Embeddings generation & Vertex AI Vector Search index integration
- [ ] **3.3 Grounded Q&A Engine**
  - [ ] Build query pipeline enforcing engagement-level authorization
  - [ ] Expose citation sources and evidence references in response

---

## 📌 Phase 4: MOVE Agent & Next Best Action

- [ ] **4.1 Blocker & Dependency Reasoning Engine**
  - [ ] Backend logic to evaluate active blockers, risks, and pending decisions
- [ ] **4.2 Next Best Action Algorithm**
  - [ ] Dynamic priority ranking based on engagement state

---

## 📌 Phase 5: DELIVER Agent & Customer Communication

- [ ] **5.1 Business Language Translation Engine**
  - [ ] Translate technical progress into manager-approved customer update drafts
- [ ] **5.2 Deliver UI**
  - [ ] Customer Update preview, edit, and manager approval interface

---

## 📌 Phase 6: SUPERVISOR Orchestration

- [ ] **6.1 Event-Driven Supervisor Coordinator**
  - [ ] Deterministic change detection & multi-agent invocation rules

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
