# CalmWork AI — Product Requirements Document (PRD)

**Version:** 1.1
**Product:** CalmWork AI
**Domain:** Future of Work & Enterprise Productivity
**Target User:** Forward-Deployed Engineers (FDEs) and their managers

---

# 1. Product Overview

CalmWork AI is an **outcome-driven work-intelligence layer for Forward-Deployed Engineers** that continuously understands the evolving customer outcome, grounds the team in engagement knowledge, identifies what is needed to keep work moving, and translates current technical reality into manager-approved business communication.

CalmWork is **not another task-management or project-management application**.

Engineering execution can continue to happen in existing engineering tools. CalmWork focuses on the layer that sits across the engagement and maintains a coherent understanding of:

* What the customer is trying to achieve
* What success means
* What has changed
* What technical work has progressed
* What is blocked
* Which dependencies and decisions matter
* What the change means for the outcome
* What should happen next
* What the customer should be told

The product is built around:

> **Four agents. One shared engagement state. Multiple reasoning capabilities. Evidence, human approval, and auditable state transitions.**

---

# 2. Product Context

## 2.1 Theme

CalmWork addresses the future of work and enterprise productivity by improving how technical professionals:

* Access engagement knowledge
* Understand changing requirements
* Reconcile customer needs with technical reality
* Make decisions
* Identify what should happen next
* Communicate progress and risk
* Complete customer-facing work with less context switching

The product should demonstrate meaningful improvements in productivity, efficiency, knowledge accessibility, decision-making, and workflow execution.

---

# 3. Problem Statement

Forward-Deployed Engineers operate between customers, business stakeholders, and technical systems.

Unlike traditional software development environments, their work is frequently performed inside continuously changing customer environments.

The customer may change requirements after seeing a prototype.

Previously unknown technical constraints may emerge.

A security approval may become necessary.

Documentation may be incomplete.

A business stakeholder may change priorities.

A dependency outside the FDE's control may block production.

Technical progress may continue while the business understanding of the project changes.

This creates a difficult coordination problem:

> **The FDE must continuously reconcile customer outcomes, requirements, technical progress, constraints, dependencies, decisions, and commitments to understand what is true now and what should happen next.**

Existing productivity systems generally track individual pieces of this work, but the intelligence connecting those pieces is often fragmented.

---

# 4. Product Thesis

CalmWork's core thesis is:

> **The productivity problem is not simply knowing what tasks exist. It is maintaining an accurate understanding of what the engagement means now, what changed, why it matters, and what should happen next.**

CalmWork therefore treats the **engagement state** as the primary unit of intelligence.

The system continuously moves through:

**Customer Reality → Understand → Know → Move → Deliver → Updated Customer Reality**

This creates a continuous work-intelligence loop rather than a static project-management workflow.

---

# 5. Target Users

## 5.1 Primary User — Forward-Deployed Engineer

The FDE needs to:

* Understand the current customer outcome
* Track changing requirements
* Retrieve engagement context quickly
* Understand decisions and their rationale
* Identify blockers and dependencies
* Determine the highest-value next action
* Understand the consequences of customer changes
* Communicate accurate status to stakeholders

## 5.2 Secondary User — FDE Manager

The manager needs to:

* Understand which engagements require attention
* Identify risks and changes early
* Review consequential recommendations
* Approve outcome changes
* Approve consequential actions
* Review customer communication
* Understand what the customer has been told
* Maintain oversight without micromanaging execution

---

# 6. Product Principles

## 6.1 Outcome before Tasks

CalmWork starts with:

**What outcome are we trying to achieve?**

rather than:

**What tasks are people doing?**

## 6.2 Current State over Static Plans

The system should prioritize what is true now over what was originally planned.

## 6.3 Evidence before Confidence

AI should not confidently make claims without supporting evidence.

> No evidence → no confident claim.

## 6.4 Human Approval for Consequential Changes

AI can detect, reason, and recommend.

Humans remain responsible for consequential decisions.

AI must never silently:

* Rewrite an outcome
* Change success criteria
* Make consequential commitments
* Send customer communication
* Claim an external action was completed

## 6.5 One Source of Truth

The centralized engagement state and timeline provide the authoritative product state.

## 6.6 Intelligence over Infrastructure Complexity

The prototype should invest complexity in useful reasoning and workflow behavior rather than unnecessary infrastructure.

## 6.7 Fail Safely

When evidence is insufficient or AI reasoning is unavailable, CalmWork should degrade safely rather than inventing information.

---

# 7. Core Architecture

CalmWork contains four specialized agents coordinated by a Supervisor.

### Agents

1. **UNDERSTAND**
2. **KNOW**
3. **MOVE**
4. **DELIVER**

### Coordinator

5. **SUPERVISOR**

The Supervisor is an orchestration layer and does not represent a fifth user-facing agent.

---

# 8. UNDERSTAND Agent

## Purpose

UNDERSTAND maintains alignment between the customer's evolving reality and the engagement outcome.

It answers:

> **Are we still solving the right problem, and has the definition of success changed?**

## Responsibilities

* Establish customer outcome
* Establish measurable success criteria / Definition of Done
* Monitor requirements
* Detect meaningful changes
* Identify outcome drift
* Recommend outcome updates
* Recommend DoD changes
* Assess impact of customer feedback
* Maintain outcome versions

---

# 9. Outcome Health Monitor

**Capability of UNDERSTAND**

Outcome Health Monitor continuously evaluates whether the current outcome and success criteria remain aligned with customer reality.

### Inputs

* Current outcome
* Outcome version
* Success criteria / DoD
* Requirements
* Customer feedback
* Timeline
* Technical progress
* Decisions
* Risks
* Dependencies
* Previous customer updates

### Outputs

Structured result containing:

* `health_status`
* `change_detected`
* `change_type`
* `evidence`
* `impact`
* `recommended_outcome`
* `recommended_dod_changes`
* `confidence`
* `requires_manager_approval`

### Example

Original outcome:

> Reduce customer onboarding time from 30 minutes to under 5 minutes.

Later:

> Customer requires enterprise SSO before production deployment.

CalmWork determines that the current definition of success may no longer fully represent the customer's production requirement.

It recommends:

* Reassessing outcome health
* Updating production success criteria
* Adding SSO/security validation to the DoD

The system does not silently change the outcome.

The manager approves or rejects the recommendation.

---

# 10. Change Impact Analysis

**Primary signature capability of UNDERSTAND + MOVE**

Change Impact Analysis determines what a meaningful customer or engagement change affects across the engagement.

It answers:

> **A change happened. What does that change actually affect?**

The system should reason across:

**Customer Change → Outcome → Requirements → DoD → Technical Work → Dependencies → Decisions → Timeline/Risk → Customer Communication**

### Example

Customer adds:

> "SSO is required before production."

CalmWork identifies:

* Outcome potentially affected
* Production DoD affected
* Authentication work affected
* Security dependency created
* Production validation affected
* Deployment target potentially affected
* Customer communication required
* Next action required

The result should include:

* What changed
* Evidence
* Affected engagement elements
* Why each element is affected
* Potential downstream consequences
* Confidence
* Recommended response
* Required approval

This capability should be implemented as a combination of:

* Structured engagement-state relationships
* Deterministic impact propagation where possible
* Gemini reasoning where interpretation is required
* Evidence grounding
* Human approval

It must not depend on hardcoded scenario-specific rules such as:

`if customer_requirement == "SSO": ...`

The system should reason over generalized engagement-state data.

---

# 11. KNOW Agent

## Purpose

KNOW provides grounded access to engagement knowledge.

It answers:

> **What do we know, and where did we learn it?**

## Responsibilities

* Retrieve engagement documents
* Retrieve historical context
* Retrieve decisions
* Retrieve architecture information
* Retrieve previous updates
* Answer engagement questions
* Provide evidence
* Preserve decision rationale
* Support handoff and customer enablement

## RAG Workflow

1. Document uploaded
2. Document stored in Cloud Storage
3. Content extracted
4. Content chunked
5. Embeddings generated
6. Embeddings stored in Vertex AI Vector Search
7. Relevant context retrieved
8. Gemini generates grounded answer
9. Evidence/source references returned

## Evidence Requirement

Knowledge answers should expose the source supporting the answer.

CalmWork should avoid unsupported statements such as:

> "The customer approved this."

unless evidence exists.

Instead:

> "The customer approved this according to the decision recorded on [source]."

---

# 12. Evidence → Reasoning → Recommendation

This is a platform-wide behavior rather than a separate agent.

Important AI outputs should expose three layers:

### Evidence

What information does CalmWork have?

### Reasoning

Why does the system interpret the evidence this way?

### Recommendation

What does CalmWork recommend doing?

This creates traceability across:

* Outcome Health
* Change Impact Analysis
* Next Best Action
* Customer communication

---

# 13. MOVE Agent

## Purpose

MOVE identifies what is preventing progress and recommends what should happen next.

It answers:

> **What is blocking progress, and what is the highest-value next action?**

## Responsibilities

* Detect blockers
* Detect dependencies
* Detect pending decisions
* Detect missing information
* Detect priority conflicts
* Identify risks
* Recommend next actions
* Explain why the action matters
* Identify expected downstream impact

---

# 14. Next Best Action

**Capability of MOVE**

Next Best Action determines the highest-value action for progressing the engagement based on current engagement state.

It considers:

* Current outcome
* Progress
* Blockers
* Dependencies
* Pending decisions
* Risks
* Missing information
* Urgency
* Downstream impact
* Customer commitments

### Example

Current state:

* API integration complete
* Production validation pending
* SSO configuration missing
* Customer security team owns the dependency

Recommended action:

> Follow up with the customer's security owner for the required SSO configuration because it is currently blocking production validation.

The recommendation should explain:

* Why this action
* Why now
* What it unblocks
* Expected result
* Evidence
* Confidence
* Whether manager approval is required

CalmWork must distinguish:

**Recommended action**

from:

**Completed action**

The system must never claim an action occurred unless completion has been verified.

---

# 15. DELIVER Agent

## Purpose

DELIVER translates current technical engagement reality into understandable business communication.

It answers:

> **What does the current technical state mean to the customer?**

## Responsibilities

* Summarize current engagement status
* Translate technical progress
* Explain changes
* Explain risks
* Explain dependencies
* Identify customer actions required
* Explain next steps
* Generate manager-reviewable customer updates

## Example

Technical state:

* API integration complete
* SSO requirement added
* SSO configuration missing
* Production deployment depends on configuration

Customer-facing interpretation:

> The integration work is progressing, but production deployment is currently waiting for the required security configuration from your team. This may affect the current deployment target. Once the configuration is received, the team can complete integration and validate the production flow.

The system must not invent:

* Progress
* Dates
* Commitments
* Customer approvals
* Business outcomes

All customer-facing communication must be generated from verified engagement state.

---

# 16. SUPERVISOR

## Purpose

The Supervisor coordinates the four agents and maintains engagement-state consistency.

## Responsibilities

* Monitor significant engagement-state changes
* Determine when reassessment is required
* Trigger relevant agent capabilities
* Coordinate transitions
* Enforce approval boundaries
* Maintain workflow state
* Ensure state transitions are recorded

The Supervisor should combine:

* Deterministic event detection
* Rules
* Structured state transitions
* Gemini reasoning where interpretation is necessary

It should not become an unnecessarily large autonomous LLM.

---

# 17. Centralized Engagement State

Firestore is the product's authoritative source of truth.

Each engagement maintains:

* Customer objective
* Current outcome
* Outcome version
* Requirements
* Success criteria / DoD
* Engagement status
* Progress
* Outcome health
* Technical progress
* Decisions
* Dependencies
* Blockers
* Risks
* Customer feedback
* Approvals
* Documents
* Customer updates
* Timeline

Conceptual structure:

```text
engagements/{engagementId}
    currentOutcome
    outcomeVersion
    status
    health
    progress
    createdAt
    updatedAt

    timeline/
    requirements/
    decisions/
    dependencies/
    approvals/
    customerUpdates/
    documents/
    risks/
```

The implementation may adjust the exact Firestore schema when necessary, but the conceptual separation should remain.

---

# 18. Engagement Timeline

The timeline is an evidence and audit layer, not simply UI history.

It should answer:

> **What happened, when did it happen, why did it matter, what changed, and what is true now?**

Timeline events may include:

* Outcome created
* Requirement added
* Requirement changed
* Customer feedback recorded
* Decision made
* Dependency detected
* Blocker detected
* Outcome health changed
* Impact analysis generated
* Recommendation generated
* Manager approval
* Customer update generated
* Customer update approved
* Engagement state changed

---

# 19. Outcome Versioning

Outcome changes should be explicitly versioned.

Example:

```text
Outcome v1
    ↓
Customer requirement changes
    ↓
UNDERSTAND detects change
    ↓
Outcome v2 recommended
    ↓
Manager approval
    ↓
Outcome v2 becomes current
    ↓
Timeline records transition
```

This prevents silent rewriting of project history.

---

# 20. Human-in-the-Loop Workflow

For consequential changes:

```text
Detect
  ↓
Ground
  ↓
Reason
  ↓
Recommend
  ↓
Manager Approval
  ↓
Act / Update State
  ↓
Verify
  ↓
Reassess
```

Examples requiring approval:

* Outcome changes
* DoD changes
* Consequential actions
* Customer communication
* Material commitments

---

# 21. User Experience

CalmWork should feel like **one intelligent engagement workspace**, not:

* An AI chatbot
* A task manager
* A dashboard
* Four disconnected agent screens

---

## 21.1 FDE Navigation

Primary areas:

* My Work
* Engagements
* Knowledge
* Timeline

---

## 21.2 FDE Home

The home experience should be outcome-first.

Primary information:

1. Current Outcome
2. Outcome Health
3. Current Progress
4. What Changed
5. Next Best Action
6. Active Dependencies
7. Pending Decisions
8. Customer Status

The primary question should be:

> **What do I need to know and do right now to move this engagement forward?**

---

# 22. Engagement Workspace

Each engagement contains:

* Overview
* Outcome
* Knowledge
* Move
* Timeline

Current-state summary:

* Customer
* Engagement
* Outcome
* Progress
* Health
* Success criteria
* Active dependencies
* Pending decisions
* Current risks
* Next action
* Customer status

---

# 23. UNDERSTAND UI

Display:

* Current customer outcome
* Outcome version
* Success criteria
* Health status
* Change detected
* Evidence
* Impact
* Recommended outcome changes
* Recommended DoD changes
* Confidence
* Approval status

Actions:

* Approve
* Reject
* Review evidence

---

# 24. KNOW UI

Primary interaction:

> **Ask anything about this engagement**

Response structure:

* Answer
* Supporting evidence
* Source
* Confidence where appropriate

The experience should make knowledge retrieval faster than manually searching engagement materials.

---

# 25. MOVE UI

Display:

* Active blockers
* Dependencies
* Pending decisions
* Missing information
* Risks
* Recommended next action
* Reasoning
* Expected impact
* Approval requirement

---

# 26. DELIVER UI

Display:

* Current engagement state
* Changes since previous update
* AI-generated customer update
* Evidence checked
* Customer action required
* Manager approval state

Actions:

* Edit
* Approve & Share

Customers do not need access to the CalmWork application for the prototype.

Managers provide approved customer communication externally.

---

# 27. Manager Control Center

The manager experience should compress engagement complexity into decision-relevant information.

### Dashboard

Show:

* Engagements
* Health
* Risks
* Outcome changes
* Pending approvals
* Customer updates awaiting approval
* Recommended actions requiring review

### Needs Your Attention

Prioritize:

* Outcome changes
* Consequential actions
* Material risks
* Customer updates
* Important dependencies

### Manager Engagement View

The manager should quickly understand:

1. What is the outcome?
2. What changed?
3. Why does it matter?
4. What is blocking progress?
5. What should happen?
6. What does the customer know?
7. What requires my approval?

---

# 28. Approval Center

The Approval Center consolidates:

* Outcome-change recommendations
* DoD changes
* Consequential actions
* Customer updates

Each approval should provide sufficient context to make a decision without reconstructing the engagement manually.

---

# 29. Google Cloud Technology Requirements

CalmWork should use Google products for AI, cloud infrastructure, deployment, authentication, storage, observability, and application services.

## Frontend

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui

Deployment:

* Firebase App Hosting and/or Google Cloud

## Backend

* Python
* FastAPI
* Cloud Run

## AI

* Gemini models through Vertex AI

Gemini should provide reasoning, interpretation, summarization, structured recommendations, and grounded generation where appropriate.

## Embeddings / RAG

* Vertex AI Embeddings
* Vertex AI Vector Search
* Cloud Storage

## Database

* Cloud Firestore

## Authentication

* Firebase Authentication and/or Google Cloud Identity Platform

## Secrets

* Google Cloud Secret Manager

## Security

* Google Cloud IAM
* Firestore Security Rules
* Application-level RBAC

## Observability

* Cloud Logging
* Cloud Monitoring

---

# 30. AI Implementation Requirements

AI must be meaningfully integrated into the core product workflow.

Generative AI should not be used merely for:

* Generic chatbot responses
* Decorative text generation
* Simple summarization without workflow impact

Gemini should directly contribute to the product's core reasoning.

---

## 30.1 UNDERSTAND

Gemini receives structured engagement state containing:

* Current outcome
* Outcome version
* DoD
* Recent timeline
* Requirements
* Customer updates
* Decisions
* Dependencies
* Technical progress
* Risks

Structured output:

```text
change_detected
change_type
evidence
impact
recommended_outcome
recommended_dod_changes
confidence
requires_manager_approval
```

Gemini must not directly overwrite the current outcome.

---

## 30.2 Change Impact Analysis

Use structured engagement relationships plus Gemini reasoning.

The system should identify downstream impact across multiple engagement dimensions.

The architecture must avoid scenario-specific hardcoding.

For example, the system should not be implemented as:

```text
if change == "SSO":
    create_security_dependency()
```

Instead, the system should interpret arbitrary meaningful changes against the current engagement state.

---

## 30.3 KNOW

Pipeline:

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
Relevant Context
    ↓
Gemini
    ↓
Answer + Evidence
```

---

## 30.4 MOVE

Gemini reasons over structured Firestore state and produces:

```text
blockers
dependencies
pending_decisions
recommended_actions
reasoning
confidence
requires_approval
```

Any action capability must pass through an authorization/policy layer.

---

## 30.5 DELIVER

Gemini receives:

* Current outcome
* Progress
* Timeline
* Dependencies
* Risks
* Customer actions
* Previous customer update
* Recent changes

It generates a customer-facing explanation based only on verified engagement state.

---

## 30.6 SUPERVISOR

Use:

* Deterministic event detection
* State-change rules
* Gemini reasoning when semantic interpretation is required

Avoid unnecessary autonomous behavior.

---

# 31. Structured AI Outputs

Agent outputs should use validated structured schemas rather than uncontrolled free-form text wherever downstream application logic depends on the result.

Recommended implementation:

* Typed Python models
* JSON schema validation
* Explicit enumerations where appropriate
* Nullable fields where evidence may be unavailable
* Confidence fields
* Approval requirements
* Evidence references

Malformed or incomplete AI output should not silently modify application state.

---

# 32. Reliability and Guardrails

CalmWork must follow:

> **No evidence → no confident claim → no consequential action.**

The AI layer should define:

* Evidence sources
* Allowed inference
* Insufficient-evidence behavior
* Confidence
* Action boundaries
* Human approval requirements
* Failure detection
* Audit trail

When Gemini cannot reliably determine an answer:

> "Insufficient evidence to determine this."

is preferable to a fabricated answer.

---

## 32.1 AI Input Privacy Guardrail

Before any user-provided, customer-provided, engagement, document, or retrieved content is sent to Gemini/LLM processing:

1. **Detection:** Detect sensitive information such as:
   * Personal names
   * Phone numbers
   * Email addresses
   * Customer-sensitive identifiers
   * Account/customer IDs
   * Credentials, secrets, tokens, API keys
   * Other sensitive personal or customer information

2. **Pre-Processing Anonymization:** Sensitive information must be anonymized or pseudonymized before LLM processing.

3. **Stable Reference Generation:** Replace sensitive entities with stable references, for example:
   * `John Smith` → `[PERSON_001]`
   * `+94XXXXXXXXX` → `[PHONE_001]`
   * `Acme Corp` → `[CUSTOMER_001]`

4. **Reference-Based Reasoning:** The LLM should reason using these references rather than the original sensitive values.

5. **Secure Reference Mapping:** Maintain a secure mapping between the reference and original value only when required for application functionality. This mapping must never be exposed to the LLM unnecessarily.

6. **Application-Layer De-anonymization:** De-anonymization must happen only in the application layer and only when authorized and necessary for the user-facing result.

7. **Pre-Boundary Enforcement:** The system must never rely only on prompting the LLM to protect sensitive data. Privacy enforcement must happen **before the LLM boundary**.

8. **Logging Protection:** Do not log raw sensitive information.

9. **Cross-Cutting Scope:** The same guardrail must apply consistently across:
   * UNDERSTAND
   * KNOW
   * MOVE
   * DELIVER
   * SUPERVISOR
   * RAG/document processing
   * User-entered text
   * Retrieved engagement context

10. **Safe Handling / Error Fallback:** If sensitive data cannot be safely anonymized, do not send that content to the LLM. Return a safe handling/error state instead.

---

# 33. Technical Engineering Quality

The implementation must follow production-oriented software engineering practices even though the initial product is a prototype.

## 33.1 Avoid Hardcoding

Do not hardcode:

* Customer names
* Engagement data
* Outcome changes
* Agent conclusions
* Impact relationships
* Recommendations
* AI responses
* Approval outcomes
* Scenario-specific logic

Demo data should be seeded through structured data/configuration.

The same product logic should operate on different engagements.

---

## 33.2 Configuration over Constants

Use configuration for:

* Environment-specific settings
* AI model configuration
* Feature flags
* Limits
* Application behavior
* Prompt/version configuration where appropriate

Sensitive configuration must use Secret Manager or appropriate environment configuration.

Secrets must never be committed to source control.

---

## 33.3 Separation of Concerns

Keep clear boundaries between:

* UI
* API
* Domain logic
* AI orchestration
* Data access
* Validation
* Authorization
* Agent workflows

Agent reasoning should not be embedded directly into UI components.

---

## 33.4 Reusable Components

Build reusable:

* UI components
* API services
* Firestore repositories
* AI service abstractions
* Schema validators
* Timeline event handlers
* Approval workflows

Avoid duplicated business logic.

---

## 33.5 Typed Interfaces

Use strong typing across application boundaries where practical.

Frontend:

* TypeScript types/interfaces

Backend:

* Python type hints
* Pydantic models
* Explicit API schemas

AI:

* Structured response schemas

---

## 33.6 Error Handling

Every external operation should have explicit failure handling.

Examples:

* Gemini unavailable
* Vector Search unavailable
* Firestore failure
* Document processing failure
* Invalid AI response
* Unauthorized action
* Missing evidence

Errors should be observable and presented to users in understandable language.

---

## 33.7 Idempotency

State-changing operations should be designed to avoid accidental duplicate transitions.

Examples:

* Duplicate approval
* Duplicate timeline events
* Duplicate customer update
* Duplicate state transition

---

## 33.8 Auditability

Record meaningful state transitions and consequential decisions in the timeline.

The system should be able to explain:

* What changed
* Who approved it
* When it happened
* What evidence supported it
* What recommendation was generated
* What state changed afterward

---

# 34. Scalability and Sustainability

The prototype architecture should provide a credible path beyond a single demo engagement.

The architecture should support:

* Multiple engagements
* Multiple FDEs
* Multiple managers
* Increasing document volume
* Increasing timeline volume
* Independent AI processing
* Cloud-based scaling

Cloud Run should allow backend workloads to scale without requiring unnecessary infrastructure.

Firestore should provide scalable engagement-state storage.

Vertex AI services should provide scalable AI and retrieval capabilities.

The design should avoid infrastructure choices that create unnecessary operational burden for the prototype.

---

# 35. Prototype Scope

The prototype should prioritize a complete end-to-end workflow over breadth.

## Required

1. Authentication
2. Engagement creation
3. Centralized engagement state
4. Timeline
5. UNDERSTAND
6. Outcome Health Monitor
7. Change Impact Analysis
8. KNOW with grounded evidence
9. MOVE
10. Next Best Action
11. DELIVER
12. Manager approval
13. State update after approval

## Secondary

* Engagement health visualization
* Outcome version history
* Impact visualization
* Evidence panels
* Timeline filtering
* Approval Center
* Polished loading/error/empty states

## Explicitly Deprioritized

Do not prioritize:

* Third-party integrations
* Autonomous external communication
* Autonomous customer actions
* Complex workflow automation
* Mobile application
* Advanced enterprise administration
* Complex event infrastructure
* Microservice-per-agent architecture
* Kubernetes
* Multi-model routing

The prototype should demonstrate intelligence rather than infrastructure complexity.

---

# 36. End-to-End Demo Scenario

## Initial State

Customer objective:

> Reduce onboarding time from 30 minutes to less than 5 minutes.

Current state:

* Progress: 70%
* Automated onboarding: complete
* API integration: complete
* Production validation: pending
* Health: Healthy

## New Customer Reality

Customer states:

> Enterprise SSO is required before production deployment.

---

## Step 1 — UNDERSTAND

Outcome Health Monitor detects a meaningful change.

Result:

> Outcome requires reassessment.

Evidence identifies the new customer requirement.

---

## Step 2 — Change Impact Analysis

CalmWork determines:

* Production DoD affected
* Security requirement added
* Authentication work affected
* New customer dependency created
* Production validation affected
* Deployment target potentially at risk
* Customer communication required

---

## Step 3 — Manager Approval

CalmWork recommends an updated DoD.

Manager approves.

The system:

* Creates new outcome/DoD version
* Updates engagement state
* Records approval
* Adds timeline event

---

## Step 4 — MOVE

Next Best Action identifies:

> Request the required SSO configuration from the customer's security team.

Reason:

> This is the primary unresolved dependency preventing production validation.

---

## Step 5 — DELIVER

CalmWork generates a customer update explaining:

* Current progress
* New requirement
* Current dependency
* Potential impact
* Customer action required
* Next step

Manager reviews and approves the communication.

---

## Step 6 — Current State

Engagement becomes:

**Outcome: At Risk**

Reason:

> A new production requirement created an unresolved security dependency.

Current next action:

> Follow up with customer security team for SSO configuration.

Customer status:

> Waiting for customer configuration.

The complete sequence is visible in the timeline.

---

# 37. Core Intelligence Loop

The three primary reasoning capabilities form a continuous loop:

```text
Customer Reality
       ↓
Outcome Health Monitor
       ↓
"Are we still solving the right problem?"
       ↓
Change Impact Analysis
       ↓
"What does this change affect?"
       ↓
Next Best Action
       ↓
"What should happen now?"
       ↓
Manager Approval
       ↓
Action / State Update
       ↓
DELIVER
       ↓
Customer understands current reality
       ↓
New Customer Reality
       ↓
Outcome Health Monitor
```

This is the core product behavior.

---

# 38. Why the Architecture Is Differentiated

CalmWork should not position itself as another general-purpose productivity suite.

Its differentiation comes from combining:

### Outcome Intelligence

Understanding whether the engagement is still solving the right problem.

### Change Impact Reasoning

Understanding the downstream consequences of changes.

### Engagement Knowledge

Grounding reasoning in customer-specific evidence.

### Next Best Action

Turning current state into an actionable recommendation.

### Business Translation

Turning technical reality into manager-approved customer communication.

These capabilities operate over one continuously maintained engagement state.

---

# 39. Success Criteria

The prototype is successful if an evaluator can observe that CalmWork:

### Productivity

* Reduces time required to reconstruct engagement context
* Reduces manual status synthesis
* Helps FDEs identify what requires attention
* Reduces unnecessary context switching

### Knowledge Accessibility

* Retrieves relevant engagement knowledge
* Provides evidence for important answers
* Makes historical decisions and context discoverable

### Decision Support

* Detects meaningful changes
* Explains downstream impact
* Identifies relevant dependencies
* Recommends appropriate next actions

### Workflow Execution

* Moves from detection → recommendation → approval → state update
* Maintains an auditable timeline
* Prevents unauthorized consequential actions

### Communication

* Converts technical reality into understandable customer communication
* Prevents unsupported claims
* Makes customer-facing status easier for managers to review

---

# 40. Evaluation-Aligned Product Quality

CalmWork should be developed against four dimensions.

## 40.1 Technical Merit and Generative AI Implementation

The implementation should demonstrate:

### Meaningful use of Gen AI

Gemini must directly contribute to:

* Outcome interpretation
* Change detection/reasoning
* Impact analysis
* Knowledge synthesis
* Next-action reasoning
* Customer communication

AI should be central to solving the problem rather than decorative.

### Technical Implementation

The prototype must be:

* Functional
* Technically coherent
* Reliably deployable
* Properly structured
* Grounded in real application state
* Protected by validation and approval boundaries

### Scalability and Sustainability

The architecture should demonstrate a credible path to:

* Multiple users
* Multiple engagements
* Increasing data
* Increasing AI workloads
* Future integrations
* Production deployment

without requiring a fundamental rewrite of the system.

---

# 41. Problem Alignment and Impact

The product should clearly demonstrate that it improves how FDEs perform everyday work.

The demo should make visible:

**Problem → AI reasoning → workflow improvement → measurable value**

Examples:

* Less time reconstructing context
* Faster identification of blockers
* Earlier detection of outcome drift
* Faster understanding of change consequences
* Better prioritization
* Less manual customer-status preparation
* Better managerial oversight

The product should focus on meaningful work improvement rather than adding AI for its own sake.

---

# 42. Innovation and Creativity

The primary innovation should be demonstrated through the interaction of the three core capabilities:

### 1. Change Impact Analysis

The system reasons about the consequences of changes across the engagement rather than simply recording that something changed.

### 2. Outcome Health Monitor

The system detects when the definition of success itself may have become outdated.

### 3. Next Best Action

The system converts the current engagement state into a prioritized action recommendation.

Together:

> **Outcome → Change → Impact → Action**

This creates a reasoning loop around the engagement rather than isolated AI features.

Innovation should therefore be demonstrated through **workflow behavior and reasoning depth**, not through the number of AI features.

---

# 43. User Experience and Solution Design

The product should be:

* Intuitive
* Outcome-first
* Evidence-driven
* Consistent
* Responsive
* Accessible
* Easy to understand without AI expertise

The four agents should feel like coordinated capabilities of one product.

The user should not need to understand the underlying agent architecture to use CalmWork.

The interface should make the following progression obvious:

> **What are we trying to achieve? → What changed? → Why does it matter? → What is blocking us? → What should I do? → What does the customer know?**

---

# 44. AI Safety and Trust Model

CalmWork must preserve human control.

### AI can:

* Observe
* Retrieve
* Interpret
* Detect
* Analyze
* Recommend
* Draft

### AI cannot independently:

* Change consequential engagement state
* Make commitments on behalf of the team
* Send customer communication
* Claim completion without verification
* Invent evidence
* Invent customer decisions

Human approval remains a first-class workflow.

---

# 45. Observability

The system should provide sufficient telemetry to understand application and AI behavior.

Monitor:

* API errors
* Gemini failures
* Invalid structured responses
* Retrieval failures
* Firestore failures
* Authentication failures
* Approval workflow failures
* AI latency
* Request latency
* Important state transitions

Use Google Cloud Logging and Cloud Monitoring.

---

# 46. Security

The application should implement:

* Authentication
* Role-based access
* Authorization checks
* Firestore Security Rules
* IAM
* Secure secret management
* Input validation
* Output validation
* AI Input Privacy Guardrail (pre-LLM boundary anonymization & stable pseudonymization)
* Non-logging of raw sensitive information
* Audit trails

The FDE should only access authorized engagements.

Managers should only perform authorized approval actions.

---

# 47. Development Quality Gates

Before considering a major feature complete, verify:

### Functional

* Does the workflow work end-to-end?
* Does application state update correctly?
* Are approvals enforced?

### AI

* Is Gemini solving a meaningful reasoning problem?
* Is the response grounded?
* Are structured outputs validated?
* Does the system handle insufficient evidence?
* Are all LLM inputs pre-processed via the AI Input Privacy Guardrail?

### Engineering

* Is business logic separated from presentation?
* Is the feature reusable?
* Is behavior configuration-driven?
* Is scenario-specific hardcoding avoided?
* Are failures handled?

### Security

* Are authorization checks present?
* Are secrets protected?
* Can unauthorized users modify state?
* Is raw sensitive data (names, emails, phones, tokens, customer IDs) prevented from entering LLM payloads and application logs?

### Scalability

* Would the same implementation work for another engagement?
* Does it depend on hardcoded customer data?
* Can additional engagements be added without code changes?

### UX

* Can the user understand why the AI made the recommendation?
* Is evidence visible?
* Is the approval boundary obvious?
* Is the next action clear?

---

# 48. Implementation Priority

## P0 — Core Product

1. Authentication
2. Engagement creation
3. Central Engagement State
4. Timeline
5. UNDERSTAND
6. Outcome Health Monitor
7. Change Impact Analysis
8. KNOW with grounded evidence
9. MOVE
10. Next Best Action
11. DELIVER
12. Manager approval
13. State update after approval
14. End-to-end demo workflow
15. Google Cloud deployment

## P1 — Product Polish

* Engagement health visualization
* Outcome version history
* Impact visualization
* Evidence panels
* Timeline filtering
* Approval Center
* Loading states
* Empty states
* Error states
* Improved accessibility

## P2 — Do Not Prioritize

* Third-party integrations
* Autonomous external actions
* Complex workflow automation
* Advanced analytics
* Mobile application
* Complex multi-tenant administration
* Complex event infrastructure
* Kubernetes
* Microservice-per-agent architecture
* Multi-model routing

---

# 49. Final Product Architecture

```text
                    ┌─────────────────────┐
                    │       User          │
                    │   FDE / Manager     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  CalmWork Web App   │
                    │ Next.js + TypeScript│
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Cloud Run / API   │
                    │   Python + FastAPI  │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ▼             ▼             ▼
        ┌──────────────┐ ┌────────────┐ ┌───────────────┐
        │  Firestore   │ │  Vertex AI │ │ Cloud Storage │
        │ Engagement   │ │   Gemini   │ │   Documents   │
        │    State     │ │            │ │               │
        └──────────────┘ └─────┬──────┘ └───────┬───────┘
                               │                │
                               ▼                ▼
                        ┌──────────────────────────┐
                        │ Vertex AI Vector Search  │
                        │       + Embeddings       │
                        └──────────────────────────┘
```

Agent orchestration operates over the centralized Firestore engagement state.

```text
                    SUPERVISOR
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   UNDERSTAND          KNOW            MOVE
        │                               │
        │                               │
        └───────────────┬───────────────┘
                        ▼
                     DELIVER
                        │
                        ▼
               Manager Approval
                        │
                        ▼
              Engagement State
                        │
                        ▼
                Customer Reality
```

---

# 50. Final Product Statement

> **CalmWork AI is an outcome-driven work-intelligence layer for Forward-Deployed Engineers that continuously understands the evolving customer outcome, grounds the team in engagement knowledge, identifies what is needed to keep work moving, and translates current technical reality into manager-approved business communication.**

The product is built around:

> **Four agents. One shared engagement state. Multiple reasoning capabilities. Evidence + human approval + auditable state transitions.**

The core intelligence loop is:

> **Understand the outcome → detect what changed → reason about its impact → determine what should happen next → get appropriate human approval → update the engagement state → communicate the current reality → continuously reassess.**

The product's complexity should come from **useful intelligence and workflow reasoning**, not infrastructure complexity.

The implementation must remain:

* Google Cloud based
* Gemini-powered
* Cloud deployable
* Evidence-grounded
* Human-controlled
* Scalable
* Maintainable
* Configuration-driven
* Free from scenario-specific hardcoding

The prototype should prove one central idea:

> **When customer reality changes, CalmWork understands what that means for the engagement and helps the team decide what to do next.**

This keeps the existing PRD architecture and product decisions intact while adding the new requirements as **first-class product, engineering, AI, scalability, UX, and quality gates**.
