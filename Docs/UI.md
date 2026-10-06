# CalmWork AI — UI/UX Design Specification

## 1. Purpose

This document defines the UI/UX structure for CalmWork AI and translates the approved PRD and TDD into an implementation-ready product experience.

The UI must present CalmWork as **one intelligent engagement workspace**, not as four separate AI agents, a generic chatbot, or a task-management application.

The experience is centered on:

> **Current Outcome → Current State → What Changed → What Matters → What Should Happen Next → What the Customer Knows**

The interface must expose AI reasoning with evidence while keeping consequential decisions and actions under human approval.

---

# 2. Core UX Principles

## 2.1 Outcome-first, not task-first

The primary question should always be:

> What customer outcome are we trying to achieve, and what is true about it now?

The UI should not lead with a conventional task list.

---

## 2.2 One engagement, one source of truth

All agents operate on the same engagement state.

The user should feel that:

* Outcome
* Requirements
* Decisions
* Dependencies
* Technical progress
* Risks
* Customer feedback
* Approvals
* Customer updates
* Timeline

are different views of the **same engagement**, not separate systems.

---

## 2.3 Intelligence should be visible

AI recommendations must not appear as unexplained conclusions.

Important AI outputs should expose:

**Evidence → Reasoning → Recommendation**

Users should be able to understand why CalmWork reached a conclusion.

---

## 2.4 Human control

CalmWork recommends and prepares.

It does not silently:

* change the customer outcome
* modify consequential engagement state
* claim an action was completed
* communicate externally without approval

Consequential actions require explicit manager approval.

---

## 2.5 Current state before history

Users should first see what is true now.

The timeline provides historical context underneath the current state.

---

## 2.6 Calm density

The interface should be information-rich without becoming visually noisy.

Use:

* clear hierarchy
* progressive disclosure
* concise status indicators
* cards for important state
* expandable evidence/reasoning
* focused action areas

Avoid excessive dashboards, charts, badges, and decorative AI elements.

---

# 3. Application Structure

CalmWork is one application with role-based experiences.

## Primary navigation

### FDE

* My Work
* Engagements
* Knowledge
* Timeline

### Manager

* Control Center
* Engagements
* Approvals
* Knowledge
* Timeline

The navigation should remain simple.

Agents should **not** appear as four top-level navigation items.

Do not create:

* Understand page
* Know page
* Move page
* Deliver page

Instead, these capabilities should appear naturally within the engagement workspace.

---

# 4. Global Application Shell

```text
┌────────────────────────────────────────────────────────────────────┐
│ CalmWork                                      Search   User ▾       │
├──────────────┬─────────────────────────────────────────────────────┤
│              │                                                     │
│ My Work      │                                                     │
│ Engagements  │              Main Content Area                      │
│ Knowledge    │                                                     │
│ Timeline     │                                                     │
│              │                                                     │
│              │                                                     │
└──────────────┴─────────────────────────────────────────────────────┘
```

For managers, the navigation changes according to role.

The application should support:

* authenticated user
* role
* current engagement
* notifications/attention indicators
* global search where appropriate

---

# 5. FDE Home — My Work

The FDE homepage is an **outcome-oriented work cockpit**.

## Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ My Work                                                     │
│                                                             │
│ Good morning, [User]                                        │
│ Here is what needs your attention.                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ CURRENT ENGAGEMENT                                          │
│ Customer Engagement                                         │
│                                                             │
│ Outcome                                                     │
│ Reduce manual processing time by 40%                        │
│                                                             │
│ ● Outcome healthy                         72% progress      │
│                                                             │
├──────────────────────────┬──────────────────────────────────┤
│ What changed             │ Next Best Action                 │
│                          │                                  │
│ Customer added SSO       │ Follow up with Security Owner    │
│ requirement              │                                  │
│                          │ Why: blocks production           │
│ View impact →            │ validation                       │
│                          │                                  │
│                          │ [View recommendation]            │
├──────────────────────────┴──────────────────────────────────┤
│ Active blockers                                             │
│                                                             │
│ ● SSO configuration — Waiting on customer                   │
│ ● Production credentials — Pending                          │
└─────────────────────────────────────────────────────────────┘
```

### Primary information hierarchy

1. Current outcome
2. Outcome health
3. Meaningful changes
4. Next Best Action
5. Blockers/dependencies
6. Customer communication status

---

# 6. Engagement Workspace

This is the central product experience.

```text
┌─────────────────────────────────────────────────────────────┐
│ ← Engagements                                               │
│                                                             │
│ [Customer / Engagement]                    ● At Risk        │
│                                                             │
│ Overview | Outcome | Knowledge | Move | Timeline            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Engagement content                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The workspace always provides the current engagement context.

---

# 7. Engagement Overview

The overview answers:

> What is happening with this engagement right now?

## Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Engagement Overview                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ CUSTOMER OUTCOME                                            │
│ Reduce manual processing time by 40%                        │
│                                                             │
│ ● Needs reassessment                                        │
│                                                             │
│ Success Criteria                                            │
│ ✓ Automated workflow deployed                              │
│ ✓ Processing time reduced by 40%                            │
│ ○ Production validation complete                            │
│                                                             │
├──────────────────────┬──────────────────────────────────────┤
│ What changed         │ Current state                        │
│                      │                                      │
│ SSO requirement      │ Integration complete                │
│ added                 │                                      │
│                      │ Production blocked                   │
│ [View impact]        │                                      │
├──────────────────────┼──────────────────────────────────────┤
│ Dependencies         │ Next Best Action                     │
│                      │                                      │
│ SSO configuration    │ Follow up with security owner       │
│ Production access    │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

---

# 8. Outcome View

This view belongs to the UNDERSTAND capability.

## Current outcome

Display:

* Outcome
* Outcome version
* Health
* Progress
* Success criteria / DoD
* Recent changes
* Last reassessment

Example:

```text
Customer Outcome

Reduce manual processing time by 40%

Version 2
● Needs reassessment

Success Criteria

✓ Automated workflow implemented
✓ Processing time benchmarked
○ Production validation
○ Customer acceptance

Last assessed
10 minutes ago
```

---

# 9. Outcome Health Monitor

When CalmWork detects potential outcome drift, display a focused insight.

```text
┌─────────────────────────────────────────────────────────────┐
│ Outcome Health                                              │
│                                                             │
│ ⚠ Outcome may need reassessment                             │
│                                                             │
│ What changed?                                               │
│ Customer introduced SSO as a production requirement.        │
│                                                             │
│ Evidence                                                    │
│                                                             │
│ • Customer requirement added                                │
│ • Production validation depends on SSO                      │
│ • Current DoD does not include SSO validation               │
│                                                             │
│ Impact                                                      │
│                                                             │
│ Current success criteria may no longer fully represent      │
│ the customer's production requirement.                      │
│                                                             │
│ Recommended change                                          │
│                                                             │
│ Add SSO configuration and production authentication          │
│ validation to the success criteria.                         │
│                                                             │
│ Confidence: High                                            │
│                                                             │
│ [View evidence]     [Reject]     [Approve change]           │
└─────────────────────────────────────────────────────────────┘
```

### Important

The UI must make clear that this is a **recommendation**, not an already-applied change.

---

# 10. Change Impact Analysis

This is the signature CalmWork workflow.

It should receive the strongest visual treatment in the product.

## Trigger

Example:

> Customer added an SSO requirement.

## Screen

```text
┌─────────────────────────────────────────────────────────────┐
│ Change Impact Analysis                                      │
│                                                             │
│ Customer requirement changed                                │
│ "SSO is required before production."                        │
│                                                             │
│ Detected: 10 minutes ago                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ WHAT DOES THIS CHANGE AFFECT?                               │
│                                                             │
│ Customer change                                             │
│        ↓                                                    │
│ Outcome                                                     │
│        ↓                                                    │
│ Success Criteria                                            │
│        ↓                                                    │
│ Technical Work                                              │
│        ↓                                                    │
│ Dependency                                                  │
│        ↓                                                    │
│ Deployment Timeline                                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ OUTCOME IMPACT                                             │
│                                                             │
│ Production-ready authentication is now required.            │
│                                                             │
│ REQUIREMENT IMPACT                                         │
│                                                             │
│ Add SSO configuration and validation.                       │
│                                                             │
│ TECHNICAL IMPACT                                           │
│                                                             │
│ Authentication integration and production validation        │
│ require additional work.                                    │
│                                                             │
│ DEPENDENCY                                                 │
│                                                             │
│ Customer security configuration is required.                │
│                                                             │
│ TIMELINE RISK                                              │
│                                                             │
│ Current deployment target may be affected.                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ RECOMMENDED NEXT ACTION                                    │
│                                                             │
│ Request SSO configuration from customer security owner.     │
│                                                             │
│ [View evidence] [Approve recommendation]                    │
└─────────────────────────────────────────────────────────────┘
```

---

# 11. Evidence / Reasoning / Recommendation Pattern

Whenever users expand an AI recommendation:

```text
Evidence
────────

Customer feedback
"SSO is required before production."

Requirement
Production deployment requires authentication.

Timeline
Production validation is currently pending.

        ↓

Reasoning
─────────

The new requirement affects the production success
criteria and introduces a customer dependency.

        ↓

Recommendation
───────────────

Request SSO configuration and update the relevant
success criteria.
```

This pattern should be reusable throughout the product.

---

# 12. Knowledge

Knowledge is the user-facing surface for KNOW.

## FDE view

```text
┌─────────────────────────────────────────────────────────────┐
│ Engagement Knowledge                                       │
│                                                             │
│ Ask anything about this engagement                          │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ What was the original success criterion?             ↑ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Suggested questions                                         │
│ • What decisions have been made?                            │
│ • What is currently blocking production?                    │
│ • Why was the architecture changed?                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Documents                                                   │
│                                                             │
│ Architecture Overview.pdf                                   │
│ Customer Requirements.docx                                  │
│ Production Readiness.md                                     │
│ Decision Log.pdf                                            │
└─────────────────────────────────────────────────────────────┘
```

---

# 13. Manager Document Upload

Managers need a dedicated upload action inside Engagement → Knowledge.

```text
┌─────────────────────────────────────────────────────────────┐
│ Engagement Knowledge                          [ + Upload ]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Upload engagement documents                                 │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │       Drag & drop files here                            │ │
│ │                                                         │ │
│ │       or [Choose files]                                 │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Category                                                    │
│ [Customer Requirements ▾]                                   │
│                                                             │
│ Description                                                 │
│ [Optional description.................................]     │
│                                                             │
│                                      [Cancel] [Upload]       │
└─────────────────────────────────────────────────────────────┘
```

Supported categories:

* Customer Requirements
* Architecture
* Technical Documentation
* Decisions
* Customer Notes
* Other

After upload:

```text
Customer Requirements.pdf

Uploading...
      ↓
Processing...
      ↓
Indexed ✓
```

The interface should distinguish:

* Uploading
* Processing
* Indexed
* Failed

---

# 14. Document List

```text
┌─────────────────────────────────────────────────────────────┐
│ Engagement Knowledge                                       │
├─────────────────────────────────────────────────────────────┤
│ Document                  Category          Status           │
│                                                             │
│ Customer Requirements.pdf Requirements     Indexed ✓        │
│ Architecture.pdf          Architecture     Indexed ✓        │
│ Decision Log.pdf          Decisions        Indexed ✓        │
│ Production Notes.docx     Technical        Processing...    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Manager controls:

* Upload
* Archive/delete
* Metadata management
* Retry failed processing

FDE controls:

* View available documents
* Ask questions
* Use evidence

---

# 15. KNOW Answer Experience

Answers should never appear as unsupported chatbot responses.

```text
Question

Why is production deployment currently blocked?

Answer

Production deployment is waiting for the customer's
SSO configuration. The integration itself is complete,
but production validation cannot proceed until the
required configuration is available.

Evidence

1. Customer Requirements.pdf
   "SSO is required before production."

2. Timeline — Oct 6
   Production validation marked as blocked.

3. Dependency
   SSO configuration — waiting on customer.

[View sources]
```

If evidence is insufficient:

```text
I don't have enough verified engagement evidence
to answer this confidently.

Relevant information is missing from the current
engagement knowledge.
```

---

# 16. Move

Move is presented as **current execution intelligence**, not as a task manager.

```text
┌─────────────────────────────────────────────────────────────┐
│ Move                                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ BLOCKERS                                                    │
│                                                             │
│ ● SSO configuration                                        │
│   Waiting on customer security team                         │
│                                                             │
│ DEPENDENCIES                                                │
│                                                             │
│ ● Production access                                        │
│   Depends on security approval                              │
│                                                             │
│ PENDING DECISIONS                                           │
│                                                             │
│ ● Production authentication approach                        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ NEXT BEST ACTION                                            │
│                                                             │
│ Follow up with customer security owner for SSO              │
│ configuration.                                              │
│                                                             │
│ Why this matters                                            │
│                                                             │
│ This is currently the highest-impact blocker to             │
│ production validation.                                      │
│                                                             │
│ [View reasoning]        [Request approval]                  │
└─────────────────────────────────────────────────────────────┘
```

---

# 17. Next Best Action

The recommendation should clearly communicate:

### Situation

What is currently happening?

### Recommendation

What should happen next?

### Reason

Why is this the highest-value action?

### Impact

What does it unblock or protect?

### Approval

Does it require manager approval?

Example:

```text
NEXT BEST ACTION

Request SSO configuration from customer security owner.

Why?

Production validation is blocked by this dependency.

Impact

Receiving the configuration enables authentication
integration and production validation.

Confidence
High

Approval required
Yes

[Approve] [Reject] [View evidence]
```

---

# 18. Deliver / Customer Update

DELIVER should not look like an independent communication product.

It should be embedded into the engagement workspace.

```text
┌─────────────────────────────────────────────────────────────┐
│ Customer Update                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Current verified state                                      │
│                                                             │
│ Integration is complete. Production validation is waiting   │
│ for the customer's SSO configuration.                       │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ Proposed customer update                                    │
│                                                             │
│ The integration work is progressing, but production         │
│ deployment is waiting for the required security             │
│ configuration from your team. This may affect the current   │
│ deployment target.                                          │
│                                                             │
│ Please provide the required SSO configuration. Once         │
│ received, the team will complete integration and validate   │
│ the production flow.                                        │
│                                                             │
│ Evidence checked ✓                                          │
│                                                             │
│ [Edit]                       [Approve & Share]               │
└─────────────────────────────────────────────────────────────┘
```

The customer does not access CalmWork directly.

The manager controls external communication.

---

# 19. Timeline

Timeline is the engagement's audit and evidence history.

It should answer:

> What happened, when, why did it matter, what changed, and what is true now?

Example:

```text
Timeline

Oct 6 — 14:20

Customer requirement changed
SSO required before production.

Impact analysis generated
Outcome, DoD, technical work and deployment
timeline potentially affected.

Oct 6 — 14:25

Manager approved outcome update.

Oct 6 — 14:27

Next Best Action generated
Request SSO configuration.

Oct 6 — 14:30

Customer update approved.

Oct 6 — 15:10

Customer configuration received.

Oct 6 — 15:12

Engagement state updated.
```

Timeline events should distinguish:

* Customer event
* AI detection
* AI recommendation
* Human approval
* State change
* Customer update
* Verified completion

---

# 20. Manager Control Center

The manager's primary question is:

> Which engagements require my attention?

## Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ Manager Control Center                                      │
│                                                             │
│ Good morning                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Needs Your Attention                                        │
│                                                             │
│ 3 Outcome changes                                           │
│ 2 Actions awaiting approval                                 │
│ 1 Customer update awaiting approval                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Engagements                                                 │
│                                                             │
│ Engagement       Health       Change       Approval          │
│                                                             │
│ Customer A       ● At Risk    2 changes    1 pending         │
│ Customer B       ● Healthy   —            —                 │
│ Customer C       ● Warning   1 change     2 pending         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# 21. Manager Approval Center

One unified approval inbox.

```text
┌─────────────────────────────────────────────────────────────┐
│ Approval Center                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ OUTCOME CHANGES                                             │
│                                                             │
│ Customer A                                                  │
│ Recommended update to success criteria                      │
│                                                             │
│ [Review]                                                    │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ ACTIONS                                                     │
│                                                             │
│ Customer B                                                  │
│ Request customer security configuration                     │
│                                                             │
│ [Review]                                                    │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ CUSTOMER UPDATES                                            │
│                                                             │
│ Customer C                                                  │
│ Update awaiting approval                                    │
│                                                             │
│ [Review]                                                    │
└─────────────────────────────────────────────────────────────┘
```

---

# 22. Approval Detail

Every approval screen should provide enough context to make a decision.

```text
┌─────────────────────────────────────────────────────────────┐
│ Review Recommendation                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Recommendation                                              │
│ Add SSO validation to production success criteria.          │
│                                                             │
│ Why                                                         │
│ Customer introduced SSO as a production requirement.        │
│                                                             │
│ Evidence                                                    │
│ • Customer Requirements                                     │
│ • Timeline event                                            │
│ • Current dependency                                        │
│                                                             │
│ Impact                                                      │
│ Production validation depends on this change.               │
│                                                             │
│ Confidence                                                  │
│ High                                                        │
│                                                             │
│ [Reject]                          [Approve]                  │
└─────────────────────────────────────────────────────────────┘
```

---

# 23. Attention States

Use a consistent semantic status model.

### Healthy

Current state aligns with the outcome.

### Needs Reassessment

Evidence suggests the outcome or success criteria may have changed.

### Blocked

A dependency prevents meaningful progress.

### At Risk

A change, dependency, or timeline issue threatens the outcome.

### Awaiting Approval

Human decision is required.

### Processing

AI/document processing is still running.

### Insufficient Evidence

CalmWork cannot confidently determine the answer.

Avoid using status colors as the only signal. Pair status with:

* icon
* text
* semantic meaning

---

# 24. AI Confidence

Confidence should not be presented as false mathematical precision.

Use:

* High
* Medium
* Low

and always provide supporting evidence.

Example:

```text
Confidence: High

Based on:
• customer requirement
• current DoD
• production dependency
• recent timeline events
```

---

# 25. Privacy UX

The user should not be required to manually anonymize customer information.

The application handles privacy before AI processing.

The interface may display the real customer name to an authorized human user, while the Gemini context receives a stable reference such as:

`[CUSTOMER_001]`

Do not expose the privacy mapping to Gemini.

If sensitive-data protection fails:

```text
AI analysis unavailable

CalmWork could not safely prepare the required
context for AI processing.

No AI recommendation was generated.
```

Do not silently bypass the privacy boundary.

---

# 26. Error and Insufficient-Evidence UX

AI failures must be explicit.

## Insufficient evidence

```text
Not enough verified evidence

CalmWork could not confidently determine whether
this requirement changes the current outcome.

Review the engagement evidence or add relevant
engagement documentation.
```

## AI processing failure

```text
Analysis unavailable

The engagement state was not changed.

Try again later.
```

## Action failure

```text
Action not completed

The requested action could not be verified.

No completion state was recorded.
```

This prevents the UI from implying successful autonomous execution.

---

# 27. Role-Based Permissions

## FDE

Can:

* view engagements
* view current outcome
* view knowledge
* ask KNOW questions
* view recommendations
* view dependencies
* view timeline
* perform permitted execution actions
* see customer-update drafts

Cannot:

* approve consequential outcome changes
* approve consequential actions
* approve external customer communication
* manage authoritative engagement documents

## Manager

Can:

* all FDE viewing capabilities
* upload documents
* manage engagement knowledge
* approve outcome changes
* approve consequential actions
* approve customer updates
* review engagement health
* manage engagement state where authorized

---

# 28. Responsive Behavior

The primary target is desktop/laptop because FDE and manager workflows are information-dense.

The UI should nevertheless remain usable on smaller screens.

Prioritize:

1. Current outcome
2. Current state
3. Recommendation
4. Evidence
5. Approval/action

Secondary information can collapse into expandable sections.

---

# 29. Component Model

The frontend should use reusable components rather than page-specific implementations.

Suggested component categories:

```text
components/
├── layout/
│   ├── AppShell
│   ├── Sidebar
│   ├── Header
│   └── Breadcrumbs
│
├── engagement/
│   ├── EngagementHeader
│   ├── OutcomeCard
│   ├── HealthIndicator
│   ├── SuccessCriteria
│   ├── EngagementState
│   └── EngagementTimeline
│
├── intelligence/
│   ├── EvidencePanel
│   ├── ReasoningPanel
│   ├── RecommendationCard
│   ├── ConfidenceIndicator
│   ├── ImpactChain
│   └── ChangeImpactCard
│
├── knowledge/
│   ├── KnowledgeSearch
│   ├── DocumentUpload
│   ├── DocumentList
│   ├── DocumentStatus
│   └── SourceReference
│
├── approvals/
│   ├── ApprovalCard
│   ├── ApprovalCenter
│   └── ApprovalDialog
│
├── deliver/
│   ├── CustomerUpdate
│   └── UpdateApproval
│
└── common/
    ├── EmptyState
    ├── ErrorState
    ├── LoadingState
    └── ConfirmationDialog
```

These are implementation components, not new product agents.

---

# 30. Interaction Pattern

The core interaction should repeatedly follow:

```text
Observe
   ↓
Show current state
   ↓
Detect meaningful change
   ↓
Show evidence
   ↓
Explain impact
   ↓
Recommend
   ↓
Request approval when required
   ↓
Execute
   ↓
Verify
   ↓
Update timeline/state
   ↓
Reassess
```

The UI should make this lifecycle understandable without exposing internal agent orchestration.

---

# 31. Primary End-to-End UX Flow

The most important prototype flow is:

```text
Manager uploads customer document
             ↓
Document processed and indexed
             ↓
FDE opens engagement
             ↓
Current outcome displayed
             ↓
New customer requirement entered/recorded
             ↓
UNDERSTAND detects outcome change
             ↓
Change Impact Analysis generated
             ↓
Evidence + impact shown
             ↓
Outcome Health updated
             ↓
Next Best Action generated
             ↓
Manager approval requested
             ↓
Manager approves
             ↓
Engagement state updated
             ↓
DELIVER generates customer update
             ↓
Manager reviews and approves
             ↓
Customer receives update outside CalmWork
             ↓
Timeline records the event
             ↓
Supervisor reassesses engagement
```

This should be the primary vertical slice used to validate the UI.

---

# 32. Visual Design Direction

The visual identity should communicate:

* calm
* trustworthy
* technical
* professional
* focused
* evidence-driven

Avoid:

* futuristic AI gimmicks
* excessive gradients
* glowing AI effects
* chatbot-first layouts
* excessive animations
* dense enterprise-dashboard aesthetics
* task-manager visual language

The product should feel like a **professional engagement intelligence workspace**.

---

# 33. What the User Should Feel

### FDE

> “I know what outcome I am driving, what changed, what is blocking me, why it matters, and what I should do next.”

### Manager

> “I know which engagements changed, why they matter, what is at risk, what requires my approval, and what the customer has been told.”

That is the UX north star.

---

# 34. Implementation Priority

Do not implement every screen simultaneously.

### Phase 1 — Core vertical slice

1. Application shell
2. FDE My Work
3. Engagement Overview
4. Outcome
5. Change Impact Analysis
6. Evidence/Reasoning/Recommendation
7. Manager Approval
8. Timeline

### Phase 2 — Knowledge

9. Manager document upload
10. Document processing status
11. Document list
12. KNOW query
13. Evidence/source display

### Phase 3 — Move + Deliver

14. Blockers/dependencies
15. Next Best Action
16. Customer Update
17. Customer Update approval

### Phase 4 — Manager experience

18. Manager Control Center
19. Approval Center
20. Cross-engagement attention view

---

# 35. UI Definition of Done

The UI is considered ready when:

* The product feels like one engagement workspace.
* Users are not required to understand the four-agent architecture.
* Current outcome is immediately visible.
* Meaningful changes are clearly surfaced.
* Change Impact Analysis is understandable without AI expertise.
* Evidence is accessible for important AI conclusions.
* Recommendations are visually distinguishable from confirmed state.
* Consequential actions clearly require approval.
* Managers can upload engagement documents.
* Document processing status is visible.
* KNOW answers expose sources.
* FDEs can identify blockers and the Next Best Action.
* Managers can review and approve customer updates.
* Timeline records meaningful state changes.
* AI failure and insufficient-evidence states are explicit.
* Privacy processing is invisible to the user unless an error occurs.
* No UI implies that an unverified action has been completed.
* The interface does not resemble a generic task-management application.
* The primary end-to-end Change Impact workflow can be completed without navigating through unnecessary screens.

---

# 36. Final UX Principle

CalmWork should not ask the user:

> “Which AI agent do you want to use?”

It should instead tell the user:

> **“Here is what is true about your engagement, what changed, why it matters, and what needs to happen next.”**

The agents are the intelligence underneath the experience.

The engagement is the product.
