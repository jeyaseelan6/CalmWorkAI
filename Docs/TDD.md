
# CalmWork AI — Technical Design Document (TDD)

**Version:** 1.0
**Product:** CalmWork AI
**Domain:** Future of Work & Enterprise Productivity
**Status:** Implementation Specification

---

# 1. Purpose

This Technical Design Document defines how CalmWork AI will be implemented.

The TDD translates the product requirements into:

* System architecture
* Application architecture
* AI/agent architecture
* Data model
* API design
* Google Cloud services
* Security
* Testing
* Observability
* Deployment
* Coding standards
* Reliability requirements
* Scalability requirements

The TDD is subordinate to the PRD.

If an implementation decision conflicts with the PRD, the PRD takes precedence.

The TDD must not introduce new product agents or silently change approved product behavior.

---

# 2. Product Architecture

CalmWork consists of:

* One web application
* One backend API
* One centralized engagement state
* Four agents
* One Supervisor
* One shared engagement timeline
* Google Cloud AI services
* Human approval workflows

## Agents

1. UNDERSTAND
2. KNOW
3. MOVE
4. DELIVER

## Coordinator

5. SUPERVISOR

The Supervisor is an orchestration component, not a fifth product agent.

---

# 3. Technology Stack

## 3.1 Frontend

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui

Responsibilities:

* User interface
* Role-based views
* Engagement workspace
* Agent result presentation
* Approval interfaces
* Timeline
* Evidence display
* API communication

---

# 3.2 Backend

* Python
* FastAPI
* Google Cloud Run

Responsibilities:

* REST API
* Authentication verification
* Authorization
* Domain logic
* Engagement state management
* Agent orchestration
* AI service invocation
* Approval workflows
* Validation
* Timeline recording

---

# 3.3 Agent Framework

Use **Google Agent Development Kit (ADK)** for agent orchestration and agent implementation where appropriate.

The installed Google ADK extension in the development environment should be used as the primary agent-development framework.

ADK should support:

* Agent definitions
* Tool usage
* Agent orchestration
* Structured outputs
* State/context handling
* Agent testing

The architecture must remain:

```text
SUPERVISOR
    │
    ├── UNDERSTAND
    ├── KNOW
    ├── MOVE
    └── DELIVER
```

Do not create additional agents simply to separate capabilities.

---

# 3.4 Generative AI

Use:

* Gemini
* Vertex AI

Gemini is responsible for semantic interpretation and reasoning where deterministic logic is insufficient.

AI functionality must directly contribute to core product behavior.

---

# 3.5 Database

Use:

**Cloud SQL for PostgreSQL**

Cloud SQL is the authoritative application database.

PostgreSQL should store:

* Engagements
* Outcomes
* Outcome versions
* Requirements
* Success criteria / DoD
* Decisions
* Dependencies
* Blockers
* Risks
* Technical progress
* Customer feedback
* Approvals
* Customer updates
* Timeline events
* AI recommendations
* Impact analyses
* Documents and document metadata
* Users and roles where appropriate

The database must not contain scenario-specific hardcoded business logic.

---

# 3.6 Document Storage

Use:

**Google Cloud Storage**

Cloud Storage stores:

* Engagement documents
* Uploaded reference files
* Source documents for RAG
* Document processing artifacts where required

The database stores metadata and references rather than unnecessarily storing large document binaries.

---

# 3.7 Embeddings and Retrieval

Use:

* Vertex AI Embeddings
* Vertex AI Vector Search

RAG architecture:

```text
Cloud Storage
      ↓
Document Processing
      ↓
Chunking
      ↓
Vertex AI Embeddings
      ↓
Vertex AI Vector Search
      ↓
Relevant Evidence
      ↓
Gemini
      ↓
Grounded Answer
```

---

# 3.8 Authentication

Use:

* Firebase Authentication and/or Google Cloud Identity Platform

The backend must validate authenticated identity before processing protected requests.

Application authorization must be enforced independently of frontend visibility.

Never rely on frontend route protection alone.

---

# 3.9 Secrets

Use:

**Google Cloud Secret Manager**

Secrets must not be:

* Hardcoded
* Committed to Git
* Stored in frontend code
* Stored in source files
* Included in logs

---

# 3.10 Deployment

Backend:

**Cloud Run**

Frontend:

**Firebase App Hosting and/or Google Cloud deployment**

The exact deployment choice should be configuration-driven.

The production-like deployment path should use Google Cloud infrastructure.

---

# 3.11 Observability

Use:

* Cloud Logging
* Cloud Monitoring

Track:

* API failures
* AI failures
* AI latency
* Database failures
* Retrieval failures
* Authentication failures
* Authorization failures
* Agent execution
* Approval workflows
* Important state transitions

---

# 3.12 Sensitive Data Protection & Privacy

Use:

* **Google Cloud Sensitive Data Protection** (Cloud DLP API)
* Application-level pseudonymization and reference management (`backend/app/privacy/`)

Responsibilities:

* Detect PII, credentials, API keys, phone numbers, emails, customer-sensitive identifiers, account IDs
* Pseudonymize sensitive text into stable references prior to sending payloads to LLM / Gemini
* Securely manage reference-to-original value mapping in application memory / encrypted storage
* Perform authorized de-anonymization in the application layer only when necessary for user response
* Enforce pre-boundary privacy policies so raw sensitive values never reach Gemini or application logs

---

# 4. High-Level System Architecture

```text
                         ┌──────────────────────┐
                         │        User          │
                         │     FDE / Manager    │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      Next.js         │
                         │     TypeScript       │
                         └──────────┬───────────┘
                                    │ HTTPS
                                    ▼
                         ┌──────────────────────┐
                         │      Cloud Run       │
                         │  FastAPI + Python    │
                         └──────────┬───────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
      ┌──────────────┐       ┌───────────────┐      ┌───────────────┐
      │  Cloud SQL   │       │   Vertex AI   │      │ Cloud Storage │
      │ PostgreSQL   │       │    Gemini     │      │   Documents   │
      └──────────────┘       └───────┬───────┘      └───────┬───────┘
                                     │                      │
                                     │                      ▼
                                     │             ┌──────────────────┐
                                     │             │ Vertex AI Vector  │
                                     │             │      Search       │
                                     │             └──────────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  Google ADK  │
                              │ Agent Layer  │
                              └──────┬───────┘
                                     │
                       ┌─────────────┼─────────────┐
                       │             │             │
                       ▼             ▼             ▼
                 UNDERSTAND       KNOW          MOVE
                       │                           │
                       └─────────────┬─────────────┘
                                     ▼
                                  DELIVER
                                     │
                                     ▼
                              Human Approval
                                     │
                                     ▼
                                Cloud SQL
```

---

# 5. Architectural Principles

## 5.1 Centralized Engagement State

Cloud SQL contains the authoritative state of the engagement.

Agents should not maintain independent conflicting versions of engagement state.

Agents read from and write through controlled application services.

---

## 5.2 Agents Are Capabilities, Not Independent Applications

Do not create separate deployable applications for each agent.

The initial architecture should use a single backend service containing modular agent implementations.

This reduces:

* Infrastructure complexity
* Deployment overhead
* Duplicate code
* Operational burden

The internal modules should remain sufficiently decoupled that individual agent components can evolve independently.

---

# 5.3 Deterministic Logic First

Use deterministic code for:

* Authorization
* Validation
* State transitions
* Approval enforcement
* Database operations
* Required-field checks
* Event creation
* Permission checks
* Known relationship traversal

Use Gemini for:

* Semantic interpretation
* Requirement interpretation
* Outcome reasoning
* Change impact reasoning
* Knowledge synthesis
* Next-best-action reasoning
* Business-language translation

Do not use an LLM where ordinary application logic is more reliable.

---

# 5.4 AI Must Not Directly Control Critical State

Gemini/agents produce recommendations.

Application services validate recommendations.

Human approval is required for consequential state changes.

Example:

```text
Gemini
   ↓
Recommendation
   ↓
Schema Validation
   ↓
Policy Check
   ↓
Manager Approval
   ↓
Domain Service
   ↓
Cloud SQL Transaction
   ↓
Timeline Event
```

---

# 6. Backend Architecture

Recommended structure:

```text
backend/
├── app/
│   ├── main.py
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── engagements.py
│   │   │   ├── outcomes.py
│   │   │   ├── knowledge.py
│   │   │   ├── move.py
│   │   │   ├── deliver.py
│   │   │   ├── approvals.py
│   │   │   └── timeline.py
│   │   └── dependencies.py
│   │
│   ├── privacy/
│   │   ├── detector.py
│   │   ├── anonymizer.py
│   │   ├── reference_manager.py
│   │   └── policy.py
│   │
│   ├── agents/
│   │   ├── supervisor/
│   │   ├── understand/
│   │   ├── know/
│   │   ├── move/
│   │   └── deliver/
│   │
│   ├── domain/
│   │   ├── engagements/
│   │   ├── outcomes/
│   │   ├── requirements/
│   │   ├── decisions/
│   │   ├── dependencies/
│   │   ├── approvals/
│   │   └── timeline/
│   │
│   ├── repositories/
│   │   ├── engagement_repository.py
│   │   ├── outcome_repository.py
│   │   ├── timeline_repository.py
│   │   └── ...
│   │
│   ├── services/
│   │   ├── engagement_service.py
│   │   ├── approval_service.py
│   │   ├── timeline_service.py
│   │   ├── impact_service.py
│   │   └── ...
│   │
│   ├── ai/
│   │   ├── gemini_client.py
│   │   ├── embeddings.py
│   │   ├── prompts/
│   │   └── schemas/
│   │
│   ├── models/
│   ├── schemas/
│   ├── policies/
│   ├── config/
│   └── utils/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── system/
│
└── pyproject.toml
```

The exact directory structure may evolve during implementation, but the separation of concerns should remain.

---

# 7. Frontend Architecture

Recommended structure:

```text
frontend/
├── app/
│   ├── dashboard/
│   ├── engagements/
│   ├── knowledge/
│   ├── approvals/
│   └── timeline/
│
├── components/
│   ├── engagement/
│   ├── outcome/
│   ├── knowledge/
│   ├── move/
│   ├── deliver/
│   ├── approval/
│   ├── timeline/
│   └── ui/
│
├── lib/
│   ├── api/
│   ├── auth/
│   ├── validation/
│   └── utils/
│
├── types/
│   ├── engagement.ts
│   ├── outcome.ts
│   ├── impact.ts
│   ├── recommendation.ts
│   └── approval.ts
│
└── tests/
```

UI components should not contain domain/business logic.

---

# 8. Database Design

Use PostgreSQL with migrations.

A migration framework should be used rather than manually modifying production schema.

---

# 9. Core Database Entities

## 9.1 users

Conceptual fields:

```text
id
external_auth_id
email
name
role
created_at
updated_at
```

Roles:

```text
FDE
MANAGER
```

---

## 9.2 engagements

```text
id
customer_name
name
description
status
progress
health
current_outcome_id
created_by
created_at
updated_at
```

---

## 9.3 outcomes

```text
id
engagement_id
version
statement
success_criteria
status
created_by
approved_by
created_at
approved_at
```

Never overwrite historical outcome versions.

---

## 9.4 requirements

```text
id
engagement_id
title
description
status
source
priority
created_at
updated_at
```

---

## 9.5 decisions

```text
id
engagement_id
title
description
decision
rationale
source
decided_by
decided_at
```

---

## 9.6 dependencies

```text
id
engagement_id
title
description
owner
status
impact
due_at
created_at
updated_at
```

---

## 9.7 risks

```text
id
engagement_id
title
description
severity
status
mitigation
created_at
updated_at
```

---

## 9.8 technical_progress

```text
id
engagement_id
description
status
evidence
created_at
updated_at
```

---

## 9.9 customer_feedback

```text
id
engagement_id
content
source
created_at
created_by
```

---

## 9.10 approvals

```text
id
engagement_id
type
target_id
status
requested_by
reviewed_by
reviewed_at
decision_note
created_at
```

Approval types may include:

```text
OUTCOME_CHANGE
DOD_CHANGE
CONSEQUENTIAL_ACTION
CUSTOMER_UPDATE
```

---

## 9.11 customer_updates

```text
id
engagement_id
content
status
generated_by
approved_by
approved_at
created_at
```

Statuses:

```text
DRAFT
AWAITING_APPROVAL
APPROVED
REJECTED
```

---

## 9.12 timeline_events

```text
id
engagement_id
event_type
title
description
actor_type
actor_id
metadata
created_at
```

Timeline metadata may contain structured references to the related entity.

---

## 9.13 impact_analyses

```text
id
engagement_id
change_description
change_source
impact_summary
confidence
status
created_at
```

Related impact elements should be stored in a normalized or structured manner depending on implementation needs.

---

## 9.14 recommendations

```text
id
engagement_id
type
title
reasoning
confidence
status
requires_approval
created_at
```

---

# 10. Database Relationships

Conceptually:

```text
Engagement
    │
    ├── Outcomes
    ├── Requirements
    ├── Decisions
    ├── Dependencies
    ├── Risks
    ├── Technical Progress
    ├── Customer Feedback
    ├── Approvals
    ├── Recommendations
    ├── Impact Analyses
    ├── Customer Updates
    └── Timeline Events
```

Foreign keys should enforce referential integrity.

Indexes should be created for common access patterns.

Examples:

* Engagement status
* Engagement owner
* Timeline by engagement + date
* Approvals by status
* Dependencies by status
* Recommendations by engagement + status

---

# 11. Transactions

Use PostgreSQL transactions for consequential state transitions.

Example:

```text
Approve outcome change
        ↓
BEGIN TRANSACTION
        ↓
Create new outcome version
        ↓
Update current outcome reference
        ↓
Update engagement health/state
        ↓
Create approval completion
        ↓
Create timeline event
        ↓
COMMIT
```

If any required operation fails, the transaction should roll back.

This prevents partially applied state changes.

---

# 12. UNDERSTAND Implementation

UNDERSTAND is responsible for outcome alignment.

Its core capabilities:

* Outcome Health Monitor
* Change Impact Analysis

---

# 13. Outcome Health Monitor Architecture

Input:

```text
Current Outcome
DoD
Recent Requirements
Customer Feedback
Timeline
Technical Progress
Dependencies
Risks
Decisions
```

Processing:

```text
Load Engagement State
        ↓
Collect Relevant Evidence
        ↓
Deterministic Change Signals
        ↓
Gemini Semantic Analysis
        ↓
Structured Result
        ↓
Schema Validation
        ↓
Persist Recommendation
        ↓
Request Approval if Required
```

Gemini output should conform to a validated schema.

Example conceptual schema:

```text
OutcomeHealthResult
├── health_status
├── change_detected
├── change_type
├── evidence[]
├── impact
├── recommended_outcome
├── recommended_dod_changes[]
├── confidence
└── requires_manager_approval
```

---

# 14. Change Impact Analysis Architecture

Change Impact Analysis should not use hardcoded mappings such as:

```text
if requirement == "SSO":
    impact security
```

Instead:

```text
New Change
    ↓
Identify affected engagement entities
    ↓
Traverse relevant relationships
    ↓
Retrieve supporting evidence
    ↓
Determine semantic consequences
    ↓
Gemini reasoning
    ↓
Structured Impact Analysis
    ↓
Validate
    ↓
Present to Manager
```

Potential impact dimensions:

* Outcome
* Requirements
* DoD
* Technical work
* Dependencies
* Decisions
* Risks
* Timeline
* Customer communication

The system should support arbitrary meaningful changes rather than only the demo scenario.

---

# 15. KNOW Implementation

KNOW provides grounded engagement knowledge.

## Document Pipeline

```text
Upload
  ↓
Cloud Storage
  ↓
Document Processing
  ↓
Text Extraction
  ↓
Chunking
  ↓
Metadata Enrichment
  ↓
Vertex AI Embeddings
  ↓
Vertex AI Vector Search
```

Each indexed chunk should retain enough metadata to identify its source.

Example metadata:

```text
engagement_id
document_id
document_name
section
chunk_id
source_reference
created_at
```

---

# 16. KNOW Query Pipeline

```text
User Question
      ↓
Authentication
      ↓
Engagement Authorization
      ↓
Query Processing
      ↓
Vector Search
      ↓
Relevant Chunks
      ↓
Gemini
      ↓
Grounded Answer
      ↓
Evidence References
      ↓
Response
```

The retrieval layer must enforce engagement-level authorization.

A user must not retrieve documents from an engagement they are not authorized to access.

---

# 17. MOVE Implementation

MOVE consumes structured engagement state.

Inputs:

* Outcome
* Progress
* Blockers
* Dependencies
* Decisions
* Risks
* Requirements
* Technical progress
* Missing information

Processing:

```text
Load Current State
      ↓
Identify Blocking Conditions
      ↓
Evaluate Dependencies
      ↓
Evaluate Risks
      ↓
Gemini Reasoning
      ↓
Rank Candidate Actions
      ↓
Structured Recommendation
      ↓
Policy Check
      ↓
Approval if Required
```

Output:

```text
MoveResult
├── blockers[]
├── dependencies[]
├── pending_decisions[]
├── recommended_actions[]
├── reasoning
├── confidence
└── requires_approval
```

---

# 18. Next Best Action

The recommendation should consider:

```text
Outcome importance
+
Blocker severity
+
Dependency impact
+
Urgency
+
Downstream impact
+
Customer commitments
+
Available information
```

The final recommendation should include:

* Action
* Reason
* Why now
* What it unblocks
* Expected result
* Evidence
* Confidence

The ranking algorithm should remain extensible.

Do not hardcode:

```text
SSO = highest priority
```

The priority should emerge from engagement state.

---

# 19. DELIVER Implementation

DELIVER converts verified engagement state into business-readable communication.

Input:

```text
Current Outcome
Progress
Recent Changes
Technical Progress
Dependencies
Risks
Customer Actions
Previous Update
Timeline
```

Processing:

```text
Load Verified State
      ↓
Select Relevant Changes
      ↓
Gemini Translation
      ↓
Validate Claims
      ↓
Generate Draft
      ↓
Manager Review
      ↓
Approval
      ↓
Customer Update State
```

The AI must not invent:

* Dates
* Progress
* Customer approvals
* Business outcomes
* Commitments
* Completed actions

---

# 20. SUPERVISOR Implementation

The Supervisor coordinates agent workflows.

The Supervisor should use deterministic events whenever possible.

Example:

```text
Requirement created/changed
        ↓
Significant change detection
        ↓
Trigger UNDERSTAND
        ↓
Outcome reassessment
        ↓
Impact Analysis
        ↓
MOVE evaluation
        ↓
DELIVER if communication is necessary
```

Not every database event should trigger every agent.

The Supervisor should determine whether an event is meaningful enough to require additional reasoning.

---

# 21. Agent Execution Model

Each agent execution should have a traceable execution context.

Conceptual:

```text
AgentExecution
├── execution_id
├── engagement_id
├── agent
├── capability
├── input_state_reference
├── model
├── started_at
├── completed_at
├── status
├── output_reference
└── error
```

This enables debugging and observability.

---

# 22. AI Prompt Architecture

Prompts should not be embedded throughout application business logic.

Maintain versioned prompt templates.

Conceptual:

```text
ai/
└── prompts/
    ├── understand/
    │   ├── outcome_health_v1
    │   └── impact_analysis_v1
    ├── know/
    │   └── grounded_answer_v1
    ├── move/
    │   └── next_best_action_v1
    └── deliver/
        └── customer_update_v1
```

Prompt versions should be identifiable in AI execution metadata.

This allows future prompt changes without losing traceability.

---

# 23. Structured AI Output

All AI outputs used by application logic must be structured.

Do not parse fragile natural-language responses using string matching.

Example:

```text
Gemini
   ↓
Structured JSON
   ↓
Pydantic Validation
   ↓
Domain Validation
   ↓
Application Logic
```

If validation fails:

1. Record failure
2. Do not modify consequential state
3. Return safe error/retry behavior
4. Log diagnostic information

---

# 24. Evidence Model

Important AI conclusions should reference evidence.

Conceptual:

```text
Evidence
├── source_type
├── source_id
├── source_reference
├── excerpt/reference
└── relevance
```

AI reasoning should distinguish between:

* Direct evidence
* Reasonable inference
* Unknown / insufficient evidence

---

# 25. Confidence

AI recommendations should include confidence where appropriate.

Confidence must not be presented as mathematical certainty.

The UI should communicate uncertainty clearly.

Low-confidence or insufficient-evidence results should require additional review rather than being treated as facts.

---

# 25.1 AI Input Privacy Guardrail Architecture

The AI Input Privacy Guardrail is a mandatory cross-cutting privacy and security layer enforced before any payload reaches Gemini or Vertex AI services.

## Guardrail Pipeline Flow

```text
Input
  ↓
Authentication / Authorization
  ↓
Sensitive Data Detection
  ↓
Anonymization / Pseudonymization
  ↓
LLM / Gemini
  ↓
Structured Result
  ↓
Authorized De-anonymization if required
  ↓
User
```

## Privacy Guardrail Module Specification (`backend/app/privacy/`)

The guardrail implementation is located in `backend/app/privacy/` and comprises four primary components:

* `detector.py`: Integrates Google Cloud Sensitive Data Protection (Cloud DLP API) combined with local regex/heuristics to identify sensitive data categories:
  * Personal names (`PERSON_NAME`)
  * Phone numbers (`PHONE_NUMBER`)
  * Email addresses (`EMAIL_ADDRESS`)
  * Customer-sensitive identifiers / Account IDs (`CUSTOMER_ID`)
  * Credentials, secrets, tokens, API keys (`AUTH_TOKEN`, `API_KEY`, `SECRET`)
  * Other PII / sensitive business entity values
* `anonymizer.py`: Replaces detected sensitive entities with deterministic, stable reference tokens (e.g. `John Smith` → `[PERSON_001]`, `+94XXXXXXXXX` → `[PHONE_001]`, `Acme Corp` → `[CUSTOMER_001]`). Re-uses identical reference tokens for multiple occurrences of the same entity within a context window to preserve relationship reasoning.
* `reference_manager.py`: Manages isolated, in-memory/ephemeral encrypted mappings between generated stable references and original sensitive values. Ensures mappings are scoped per execution context and NEVER included in LLM prompts or payload logs.
* `policy.py`: Enforces pre-boundary validation policies. If sensitive data detection or anonymization fails, or if content contains un-anonymizable sensitive data, the policy blocks LLM invocation and triggers a safe handling/error response.

## Mandatory Guardrail Requirements

1. **Pre-Boundary Enforcement:** Privacy processing occurs strictly before payloads enter the LLM boundary. System prompt instructions alone are explicitly prohibited as a privacy mechanism.
2. **Stable References:** Entity references are stable within an execution turn (e.g., `[PERSON_001]`, `[CUSTOMER_001]`) enabling Gemini to reason over entity relationships without exposing raw identities.
3. **No Raw Data Logging:** Raw sensitive data is scrubbed from application logs, execution metadata, and Vertex AI request/response logs.
4. **Cross-Agent Scope:** The guardrail applies consistently across all 4 agents (`UNDERSTAND`, `KNOW`, `MOVE`, `DELIVER`), the `SUPERVISOR`, RAG document ingestion, query pipelines, user-entered text, and retrieved engagement state.
5. **Authorized Application-Layer De-anonymization:** Replacement of stable references back to original entity values occurs exclusively within the application layer after LLM output validation, and only when authorized and necessary for user presentation.
6. **Failure Safety:** If detection fails or data cannot be safely anonymized, the system does not fallback to raw text sending; it aborts the LLM invocation and returns a controlled error state.

Do NOT create a new agent for this capability. It is a cross-cutting security/privacy layer used by the existing architecture.

---

# 26. Approval Architecture

Consequential operations pass through:

```text
AI Recommendation
      ↓
Validation
      ↓
Authorization
      ↓
Approval Request
      ↓
Manager Review
      ↓
Approved / Rejected
```

Approval must be enforced server-side.

A malicious or buggy frontend must not be able to bypass approval requirements.

---

# 27. State Transition Rules

State transitions should be implemented in domain services rather than directly inside route handlers.

Example:

```text
approve_outcome_change()
```

may:

1. Verify user authorization
2. Verify recommendation exists
3. Verify recommendation has not already been processed
4. Create new outcome version
5. Update engagement reference
6. Update relevant health state
7. Record approval
8. Create timeline event
9. Return updated state

This operation should occur transactionally.

---

# 28. API Design

Use REST APIs with versioned endpoints.

Example:

```text
/api/v1/engagements
/api/v1/engagements/{id}
/api/v1/engagements/{id}/outcome
/api/v1/engagements/{id}/understand/health
/api/v1/engagements/{id}/understand/impact
/api/v1/engagements/{id}/knowledge/query
/api/v1/engagements/{id}/move/next-action
/api/v1/engagements/{id}/deliver/update
/api/v1/approvals
/api/v1/timeline
```

Exact endpoint names may evolve, but APIs should remain resource-oriented and versioned.

---

# 29. API Contracts

Every API should define:

* Request schema
* Response schema
* Authentication requirement
* Authorization requirement
* Validation rules
* Error responses

FastAPI/Pydantic should generate and maintain OpenAPI documentation.

---

# 30. Error Handling

Use consistent API errors.

Conceptual response:

```text
{
  "error": {
    "code": "INSUFFICIENT_EVIDENCE",
    "message": "There is insufficient evidence to make this recommendation.",
    "request_id": "..."
  }
}
```

Do not expose:

* Secrets
* Stack traces
* Internal credentials
* Sensitive infrastructure details

to end users.

---

# 31. Frontend State Management

The frontend should treat backend state as authoritative.

Do not duplicate complex engagement business logic in the frontend.

Frontend responsibilities:

* Display state
* Collect user input
* Trigger API calls
* Show loading states
* Show errors
* Present AI evidence
* Present recommendations
* Request approvals

Backend remains authoritative for:

* Permissions
* State transitions
* Approval enforcement
* AI processing
* Database mutation

---

# 32. Authentication and Authorization

Every protected backend endpoint should establish:

1. Identity
2. Role
3. Engagement access
4. Requested operation permission

Example:

```text
FDE
 ├── View authorized engagement
 ├── Run analysis
 ├── View recommendations
 └── Cannot approve manager-only changes

MANAGER
 ├── View authorized engagements
 ├── Review recommendations
 ├── Approve consequential changes
 └── Approve customer updates
```

Authorization must be implemented server-side.

---

# 33. Multi-Engagement Design

The system must not assume only one engagement exists.

All engagement-related records should include appropriate engagement references.

Queries should always scope data to authorized engagements.

Avoid global mutable state containing engagement-specific information.

---

# 34. Configuration Management

Avoid hardcoded application behavior.

Use environment/configuration for:

* Database connection
* Google Cloud project
* Cloud Storage bucket
* Vertex AI configuration
* Vector Search configuration
* Model configuration
* Feature flags
* Environment
* Logging configuration

Development, staging, and production configuration should be separable.

---

# 35. No Scenario-Specific Hardcoding

The demonstration scenario is test/seed data, not application logic.

Do not encode:

```text
Customer = Acme
Requirement = SSO
Impact = Security
Action = Contact Security Team
```

as application rules.

Instead, seed:

```text
Customer
Outcome
Requirements
Dependencies
Technical Progress
```

and allow the actual reasoning system to derive:

```text
Impact
Recommendation
Risk
Customer Communication
```

from state and evidence.

---

# 36. Seed Data

Demo data should be loaded through:

* Database seed scripts
* Fixtures
* Configuration files

Seed data should be clearly separated from production code.

This allows the same application to run against different engagement scenarios.

---

# 37. Comments and Documentation

Code should contain comments where they improve understanding.

Good comments explain:

* Why a non-obvious decision exists
* Why an AI guardrail exists
* Why a state transition is transactional
* Why a particular fallback behavior is necessary
* Why deterministic logic is preferred in a particular location

Avoid comments that simply restate code.

Bad:

```python
# Increment counter
counter += 1
```

Good:

```python
# Outcome versions are immutable so the timeline can reconstruct
# exactly when and why the engagement definition of success changed.
```

Public/reusable modules should have appropriate documentation.

---

# 38. Coding Standards

## Python

Follow:

* PEP 8
* Type hints
* Pydantic validation
* Small focused functions
* Clear domain boundaries
* Explicit error handling
* Dependency injection where appropriate

Avoid:

* Large monolithic functions
* Global mutable state
* Hidden side effects
* Business logic inside API routes

---

## TypeScript

Use:

* Strict TypeScript configuration
* Explicit types for API boundaries
* Reusable components
* Small focused functions
* Consistent naming
* Safe null/undefined handling

Avoid:

* `any` unless genuinely necessary
* Duplicated types
* Business logic in UI components
* Direct database access from frontend

---

# 39. Dependency Management

Dependencies should be:

* Explicitly declared
* Version controlled
* Regularly reviewed
* Limited to necessary packages

Do not add libraries merely because they simplify a small amount of code.

Prefer platform capabilities and existing project dependencies where practical.

---

# 40. Unit Testing

Unit tests are mandatory for domain logic.

Test:

* Outcome health logic
* Impact-analysis preprocessing
* Recommendation ranking
* Approval rules
* Authorization policies
* State transitions
* Validation
* Timeline event creation
* Utility functions
* AI response validation

Unit tests should be fast and isolated.

External Google Cloud services should generally be mocked or replaced with test doubles at this level.

---

# 41. Integration Testing

Integration tests should verify interactions between application components.

Examples:

### Database

* Repository CRUD
* Relationships
* Transactions
* Outcome versioning
* Timeline persistence

### API

* Request validation
* Authentication
* Authorization
* Database interaction
* State transitions

### AI Integration

Where practical, test:

* Gemini client integration
* Structured response parsing
* Vertex AI retrieval integration
* Evidence mapping

Use controlled test fixtures rather than unpredictable production data.

---

# 42. System Testing

System tests should exercise complete user workflows.

Minimum system scenarios:

## Scenario 1 — Engagement Creation

```text
Login
 ↓
Create Engagement
 ↓
Define Outcome
 ↓
View Engagement
```

Expected:

* Engagement persisted
* Outcome persisted
* Timeline event created

---

## Scenario 2 — Outcome Drift

```text
Existing Outcome
 ↓
New Customer Requirement
 ↓
Outcome Health Monitor
 ↓
Reassessment Recommendation
 ↓
Manager Approval
 ↓
New Outcome Version
```

Expected:

* Previous outcome preserved
* New version created
* Approval recorded
* Timeline updated

---

## Scenario 3 — Change Impact

```text
Customer Change
 ↓
Impact Analysis
 ↓
Evidence
 ↓
Affected Elements
 ↓
Recommendation
```

Expected:

* Multiple affected engagement dimensions identified
* Reasoning is visible
* No hardcoded SSO-specific behavior

---

## Scenario 4 — Next Best Action

```text
Blocked Engagement
 ↓
MOVE
 ↓
Recommended Action
 ↓
Reasoning
 ↓
Approval if required
```

Expected:

* Recommendation grounded in state
* Action explains why it matters
* No false completion claim

---

## Scenario 5 — Customer Update

```text
Updated Engagement State
 ↓
DELIVER
 ↓
Customer Update Draft
 ↓
Manager Review
 ↓
Approval
```

Expected:

* Update reflects verified state
* Unsupported claims are avoided
* Approval recorded
* Timeline updated

---

## Scenario 6 — KNOW

```text
Upload Document
 ↓
Index
 ↓
Ask Question
 ↓
Retrieve Evidence
 ↓
Gemini Answer
```

Expected:

* Relevant evidence retrieved
* Answer grounded in retrieved material
* Source references displayed

---

# 43. AI Evaluation Tests

AI behavior should have explicit evaluation cases.

At minimum test:

### Correct reasoning

Given a meaningful customer change, does the system identify relevant downstream impact?

### Insufficient evidence

Given incomplete evidence, does the system avoid inventing facts?

### Irrelevant information

Given unrelated timeline events, does the system avoid treating them as causal?

### Conflicting evidence

Does the system identify conflicting information rather than confidently selecting an unsupported answer?

### Action ranking

Does Next Best Action prioritize actions based on actual engagement state?

### Communication fidelity

Does DELIVER preserve verified facts without inventing commitments?

---

# 44. Regression Testing

Important AI scenarios should be stored as regression cases.

Whenever prompts, schemas, models, retrieval configuration, or reasoning logic change, the regression suite should be rerun.

This is particularly important for:

* Change Impact Analysis
* Outcome Health
* Next Best Action
* Grounded KNOW responses
* Customer updates
* AI Input Privacy Guardrail anonymization & de-anonymization

---

## 44.1 AI Input Privacy Guardrail Tests

The test suite must explicitly cover the privacy guardrail across unit, integration, system, and AI payload verification:

1. **Entity Detection Tests:**
   * Personal names (e.g. `John Smith`)
   * Phone numbers (e.g. `+94XXXXXXXXX`)
   * Email addresses (e.g. `user@example.com`)
   * Customer-sensitive identifiers / Account IDs
   * Credentials, secrets, tokens, API keys (`bearer_token`, `sk-proj-...`)

2. **Anonymization & Pseudonymization Tests:**
   * Replacement of sensitive data with stable tokens (`[PERSON_001]`, `[PHONE_001]`, `[CUSTOMER_001]`)
   * Mixed content containing sensitive and non-sensitive text
   * Multiple occurrences of the same entity within a context window (verifying stable token reuse)

3. **De-anonymization & Authorization Tests:**
   * Verification of authorized application-layer de-anonymization for user presentation
   * Blockage of unauthorized de-anonymization attempts

4. **Failure & Error Recovery Tests:**
   * Detection failure handling (ensures un-anonymized payload is NEVER forwarded to LLM)
   * LLM failure handling with active reference mappings
   * Verification that safe handling/error state is returned when content cannot be safely anonymized

5. **Payload & Log Verification Tests:**
   * Automated assertions verifying raw sensitive values are absent from all LLM request payloads
   * Automated log checks confirming raw PII/credentials are not written to application or Cloud Logging streams

---

# 45. Test Pyramid

Target:

```text
          System Tests
         /             \
        / Integration   \
       /                 \
      /    Unit Tests     \
     /_____________________\
```

Most tests should be unit tests.

Integration tests validate important component boundaries.

System tests validate a small number of critical end-to-end workflows.

---

# 46. Testability Requirements

Design components for testing.

Avoid deeply coupled code such as:

```text
API route
  → Gemini
  → database
  → business logic
  → timeline
```

inside one function.

Prefer:

```text
API
 ↓
Service
 ↓
Domain Logic
 ↓
Repository / AI Service
```

This allows each layer to be tested independently.

---

# 47. Reliability Strategy

The system should fail safely.

## Gemini failure

Do not mutate consequential state.

Show:

> AI analysis is temporarily unavailable.

## Retrieval failure

Do not present unsupported answers.

## Database failure

Do not claim state was updated.

## Invalid AI response

Reject the response and record the failure.

## Approval failure

Do not partially apply the state change.

---

# 48. Idempotency

State-changing operations must avoid duplicate effects.

Examples:

* Duplicate approval requests
* Duplicate approval submissions
* Duplicate timeline events
* Duplicate customer updates
* Duplicate state transitions

Use database constraints and idempotency keys where appropriate.

---

# 49. Concurrency

Multiple users or agent executions may attempt to modify the same engagement.

Use PostgreSQL transactions and appropriate locking/versioning mechanisms for consequential updates.

Outcome changes should use optimistic concurrency or equivalent protection so an outdated recommendation cannot overwrite newer engagement state.

---

# 50. Audit Trail

Important operations should produce timeline events.

Examples:

```text
OUTCOME_CREATED
REQUIREMENT_CHANGED
OUTCOME_REASSESSMENT
IMPACT_ANALYSIS_CREATED
RECOMMENDATION_CREATED
APPROVAL_REQUESTED
APPROVAL_GRANTED
APPROVAL_REJECTED
CUSTOMER_UPDATE_DRAFTED
CUSTOMER_UPDATE_APPROVED
ENGAGEMENT_STATE_CHANGED
```

Timeline events should be append-oriented.

Historical events should not be silently rewritten.

---

# 51. Observability

Each request should have a correlation/request ID.

AI execution should have an execution ID.

Logs should make it possible to trace:

```text
User Request
 ↓
API
 ↓
Agent
 ↓
Gemini
 ↓
Database
 ↓
Approval
 ↓
Timeline
```

Do not log sensitive content unnecessarily.

---

# 52. Performance

The application should avoid unnecessary sequential operations.

Examples:

* Retrieve independent engagement data concurrently where safe.
* Avoid repeated database queries for the same state.
* Avoid sending irrelevant context to Gemini.
* Retrieve only relevant RAG chunks.
* Paginate long timelines.
* Avoid loading entire engagement history for every UI request.

AI calls should be minimized when deterministic information is sufficient.

---

# 53. Scalability

The application should support multiple engagements without architecture changes.

Cloud Run should allow backend instances to scale horizontally.

The backend should remain stateless wherever possible.

Do not store engagement state in process memory.

Cloud SQL should remain the authoritative state store.

AI workloads should be designed so increased engagement volume does not require manually creating agent instances.

---

# 54. Security Requirements

## Authentication

Every protected endpoint requires authenticated identity.

## Authorization

Every engagement operation verifies access.

## Database

Use parameterized queries/ORM mechanisms.

Never construct SQL through unsafe string concatenation.

## Secrets

Use Secret Manager.

## Input Validation

Validate:

* API payloads
* Uploaded document metadata
* User-generated text
* AI outputs

## AI Input Privacy Guardrail

* Execute pre-boundary detection and pseudonymization before sending any content to LLM / Gemini.
* Replace names, emails, phone numbers, customer IDs, tokens, and credentials with stable tokens (`[PERSON_001]`, `[CUSTOMER_001]`).
* Scrub raw sensitive entity values from application logs and Cloud Logging streams.
* Abort LLM execution and return safe handling/error state if privacy pre-processing or anonymization fails.

## Frontend

Do not expose service-account credentials or server-side secrets.

---

# 55. Data Privacy

Only necessary engagement information should be sent to AI services.

Before sending context to Gemini:

* Scope it to the relevant engagement
* Run all text payloads through the AI Input Privacy Guardrail (`backend/app/privacy/`)
* Replace PII and customer-sensitive data with stable references before LLM boundary transit
* Exclude irrelevant data
* Apply authorization
* Avoid unnecessary sensitive information

The system should preserve source references for traceability without exposing unauthorized content or raw sensitive identities.

---

# 56. Deployment Architecture

## Development

Local:

```text
Next.js
   ↓
FastAPI
   ↓
Google Cloud services
```

Where practical, development can use dedicated development resources.

## Cloud

```text
Firebase / Google Cloud
        ↓
Cloud Run
        ↓
Cloud SQL
        ↓
Vertex AI
        ↓
Cloud Storage / Vector Search
```

---

# 57. Environment Separation

Support:

```text
development
staging
production
```

Each environment should have separate configuration.

Avoid environment checks scattered throughout business logic.

Use centralized configuration.

---

# 58. CI/CD

The codebase should support automated:

1. Formatting
2. Linting
3. Type checking
4. Unit tests
5. Integration tests
6. Build validation
7. System tests where practical
8. Deployment

A failed quality gate should prevent deployment.

---

# 59. Frontend Quality

The frontend must include:

* Loading states
* Error states
* Empty states
* Confirmation states
* Approval states
* Disabled states during mutations
* Accessible controls
* Keyboard-accessible interactions
* Responsive layouts

AI output should not appear as unexplained black-box text.

Evidence and reasoning should be discoverable.

---

# 60. AI UX

AI-generated information should visually distinguish:

* Current verified state
* AI interpretation
* AI recommendation
* Human-approved state

For example:

```text
CURRENT STATE
SSO configuration is pending.

AI ANALYSIS
This dependency currently blocks production validation.

RECOMMENDED ACTION
Request configuration from the customer security owner.

APPROVAL
Manager approval required.
```

This separation improves user trust.

---

# 61. Core End-to-End Workflow

The primary system workflow is:

```text
Customer Reality
       ↓
Central Engagement State
       ↓
SUPERVISOR
       ↓
UNDERSTAND
       ↓
Outcome Health Monitor
       ↓
Change Impact Analysis
       ↓
KNOW
       ↓
Evidence / Context
       ↓
MOVE
       ↓
Next Best Action
       ↓
Manager Approval
       ↓
State Update
       ↓
DELIVER
       ↓
Customer Communication
       ↓
New Customer Reality
       ↓
Reassessment
```

---

# 62. Demo Implementation Requirement

The demo scenario must be implemented using the same generalized application logic as other engagements.

The demo should not have special-case code.

The following should be seed data:

* Customer
* Objective
* Initial outcome
* Requirements
* Technical progress
* SSO requirement
* Existing dependency

The system should derive:

* Outcome health change
* Impact
* Recommendation
* Next best action
* Customer communication

through actual application logic and Gemini reasoning.

---

# 63. Definition of Done — Technical

A feature is technically complete only when:

* Frontend implemented
* Backend API implemented
* Domain logic separated
* Validation implemented
* Authorization implemented
* Error handling implemented
* Unit tests written
* Integration tests written where relevant
* System test added for critical workflow
* AI outputs structured where applicable
* AI evidence supported where applicable
* No scenario-specific hardcoding
* Logging implemented
* Comments/documentation added where useful
* Configuration externalized
* No secrets committed
* Code passes linting/type checking
* Deployment succeeds

---

# 64. Implementation Priority

## Phase 1 — Foundation

1. Project setup
2. Next.js + TypeScript
3. Python + FastAPI
4. Cloud Run
5. Cloud SQL
6. Authentication
7. Database migrations
8. Core engagement APIs
9. AI Input Privacy Guardrail (`backend/app/privacy/`)
10. Timeline
11. Seed data

## Phase 2 — UNDERSTAND

12. Outcome model
13. Outcome versioning
14. Outcome Health Monitor
15. Change detection
16. Change Impact Analysis
17. Approval workflow

## Phase 3 — KNOW

18. Cloud Storage
19. Document processing
20. Vertex AI Embeddings
21. Vertex AI Vector Search
22. Grounded Gemini responses
23. Evidence UI

## Phase 4 — MOVE

24. Blocker detection
25. Dependency reasoning
26. Next Best Action
27. Approval integration

## Phase 5 — DELIVER

28. Customer state synthesis
29. Customer update generation
30. Manager review
31. Approval
32. Timeline integration

## Phase 6 — SUPERVISOR

33. Significant change detection
34. Agent triggering
35. Workflow coordination
36. State consistency

## Phase 7 — Quality

37. Unit test suite (including Privacy Guardrail detectors/anonymizers)
38. Integration test suite
39. System test suite
40. AI regression tests & Privacy payload validation
41. Error handling
42. Observability
43. Security review
44. Performance review

## Phase 8 — Deployment

45. Google Cloud deployment
46. Production-like configuration
47. End-to-end validation
48. Demo rehearsal

---

# 65. Explicit Non-Goals

Do not implement during the initial prototype:

* Slack integration
* Microsoft Teams integration
* WhatsApp integration
* Google Meet integration
* Google Drive integration as an external connector
* Jira integration
* GitHub integration
* Autonomous customer communication
* Autonomous consequential actions
* Mobile application
* Kubernetes
* Microservice-per-agent architecture
* Complex event bus
* Multi-model routing
* Large enterprise administration system
* Advanced analytics platform

These can be future considerations but should not consume prototype implementation time.

---

# 66. Architecture Decision Summary

| Concern                  | Decision                                    |
| ------------------------ | ------------------------------------------- |
| Frontend                 | Next.js + TypeScript                        |
| UI                       | Tailwind + shadcn/ui                        |
| Backend                  | Python + FastAPI                            |
| Compute                  | Cloud Run                                   |
| Agent framework          | Google ADK                                  |
| Generative AI            | Gemini via Vertex AI                        |
| AI Input Privacy         | Google Cloud Sensitive Data Protection + App Pseudonymization (`backend/app/privacy/`) |
| Embeddings               | Vertex AI Embeddings                        |
| Vector search            | Vertex AI Vector Search                     |
| Application database     | Cloud SQL for PostgreSQL                    |
| File storage             | Cloud Storage                               |
| Authentication           | Firebase Authentication / Identity Platform |
| Secrets                  | Secret Manager                              |
| Logging                  | Cloud Logging                               |
| Monitoring               | Cloud Monitoring                            |
| Agents                   | UNDERSTAND, KNOW, MOVE, DELIVER             |
| Coordinator              | SUPERVISOR                                  |
| Approval                 | Server-enforced human approval              |
| State authority          | Cloud SQL                                   |
| AI output                | Structured + validated                      |
| Testing                  | Unit + Integration + System + AI regression + Privacy Guardrail tests |
| Deployment               | Google Cloud                                |
| Configuration            | Externalized                                |
| Hardcoded scenario logic | Prohibited                                  |

---

# 67. Final Engineering Principle

CalmWork should be implemented as a **real software product with a small, maintainable architecture**, not as a collection of hardcoded AI demonstrations.

The implementation should follow:

> **Strong types → validated inputs → deterministic business rules → grounded Gemini reasoning → structured outputs → policy checks → human approval → transactional state updates → auditable timeline.**

The product should demonstrate sophisticated AI reasoning while maintaining conventional software engineering discipline.

The central technical principle is:

> **AI provides intelligence; application code provides control.**

And the central architectural principle remains:

> **Four agents. One shared engagement state. Multiple reasoning capabilities. Evidence + human approval + auditable state transitions.**
