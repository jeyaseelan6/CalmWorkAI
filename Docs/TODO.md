# CalmWork AI — Implementation Master TODO List

**Status:** Implementation Starting  
**Architecture:** Next.js + TypeScript (Frontend) | Python + FastAPI (Backend) | PostgreSQL (Cloud SQL) | Gemini via Vertex AI | Google Cloud DLP (`backend/app/privacy/`)  

---

## 📌 Phase 1: Project Foundation & Core Infrastructure (Current Priority)

- [ ] **1.1 Monorepo & Directory Setup**
  - [ ] Setup `frontend/` (Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui)
  - [ ] Setup `backend/` (Python 3.11+, FastAPI, Uvicorn, Pydantic v2, SQLAlchemy/Alembic)
- [ ] **1.2 AI Input Privacy Guardrail Module (`backend/app/privacy/`)**
  - [ ] Implement `detector.py` (Google Cloud Sensitive Data Protection / Cloud DLP + local regex for names, emails, phones, customer IDs, tokens/keys)
  - [ ] Implement `anonymizer.py` (Stable token replacement: `[PERSON_001]`, `[CUSTOMER_001]`)
  - [ ] Implement `reference_manager.py` (Isolated, context-scoped encrypted mapping manager)
  - [ ] Implement `policy.py` (Pre-LLM gatekeeping, payload validation, error fallback)
- [ ] **1.3 Database Setup & Schema Migrations**
  - [ ] Setup PostgreSQL schema (`engagements`, `outcomes`, `requirements`, `decisions`, `dependencies`, `risks`, `technical_progress`, `approvals`, `customer_updates`, `timeline_events`, `impact_analyses`, `recommendations`)
  - [ ] Configure Alembic database migration scripts
- [ ] **1.4 Backend Core Architecture**
  - [ ] Configure FastAPI app shell (`main.py`, CORS, healthcheck, router registration)
  - [ ] Implement authentication & authorization dependencies
  - [ ] Build domain repositories and services
- [ ] **1.5 Frontend Application Shell**
  - [ ] Build global layout shell (`AppShell`, `Sidebar`, `Header`, `Breadcrumbs`)
  - [ ] Implement FDE Navigation (`My Work`, `Engagements`, `Knowledge`, `Timeline`)
  - [ ] Implement Manager Navigation (`Control Center`, `Engagements`, `Approvals`, `Knowledge`, `Timeline`)
- [ ] **1.6 Seed Data Script**
  - [ ] Create seed script for initial customer onboarding + SSO requirement demo scenario

---

## 📌 Phase 2: UNDERSTAND Agent & Change Impact Analysis

- [ ] **2.1 Outcome Data Model & Immutable Versioning**
  - [ ] Implement transactional outcome versioning (preserving historical DoD versions)
- [ ] **2.2 Outcome Health Monitor**
  - [ ] Build Gemini semantic analysis service for detecting outcome drift
  - [ ] Schema validation for structured output (`OutcomeHealthResult`)
- [ ] **2.3 Change Impact Analysis Engine**
  - [ ] Build generalized multi-dimensional impact propagation engine (Outcome → Requirement → DoD → Work → Dependency → Timeline → Comms)
- [ ] **2.4 Change Impact UI**
  - [ ] Implement `OutcomeCard`, `OutcomeHealthMonitor`, and signature `ChangeImpactCard` with **Evidence → Reasoning → Recommendation** layout

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
- [ ] **3.4 Knowledge UI**
  - [ ] Manager Document Upload interface with status indicator (`Uploading` → `Processing` → `Indexed`)
  - [ ] Grounded Q&A search view with evidence cards

---

## 📌 Phase 4: MOVE Agent & Next Best Action

- [ ] **4.1 Blocker & Dependency Reasoning Engine**
  - [ ] Backend logic to evaluate active blockers, risks, and pending decisions
- [ ] **4.2 Next Best Action Algorithm**
  - [ ] Dynamic priority ranking based on engagement state
- [ ] **4.3 Move UI**
  - [ ] Execution intelligence view (`Blockers`, `Dependencies`, `Pending Decisions`, `Next Best Action` card)

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
