"""
Morning Brief Agentic Skill — Procedural Knowledge & Instructions.
Specifies the exact multi-stage reasoning steps, agentic delegation protocols,
and operational invariants governing the Morning Brief execution.
"""

from app.agents.invariants import UNIVERSAL_AGENT_INVARIANTS

MORNING_BRIEF_PROCEDURAL_GUIDE = f"""
{UNIVERSAL_AGENT_INVARIANTS}

SKILL NAME: Morning Brief Agentic Skill (skill_morning_brief)
GOAL: Synthesize an authoritative, evidence-backed daily operational plan for Forward-Deployed Engineers.

PROCEDURAL WORKFLOW PROTOCOL:

1. SNAPSHOT STATE:
   - Load the authoritative engagement state, current outcome version, definition of done checklist,
     active work plan tasks, and recent timeline events.
   - Ground all context strictly in verified database records.

2. ASSESS SCOPE & OUTCOME DRIFT (PLAN Agent):
   - Evaluate recent worknotes, customer inputs, or requirement changes against the active Outcome.
   - Detect if contract drift has occurred or if milestone definitions require manager reassessment.
   - Flag outcome health as HEALTHY, ATTENTION, or NEEDS_REASSESSMENT.

3. GROUNDED EVIDENCE RETRIEVAL (KNOW Agent):
   - Anchor reasoning in customer technical specifications, runbooks, and verified documents.
   - Compute token relevance scores; cite source document titles and snippet excerpts.
   - If verified evidence is lacking, state clearly that verified engagement evidence is insufficient.

4. TRIAGE BLOCKERS & CALCULATE VELOCITY (MOVE Agent):
   - Identify active bottlenecks, external customer dependencies, and pending manager approvals.
   - Isolate the single highest-leverage Next Best Action with explicit 'Why Now' justification.
   - Distinguish verified facts from AI interpretations and hypotheses.

5. ASSEMBLE WORK PLAN & IST DEADLINE TARGETS (SUPERVISOR Synthesis):
   - Compile findings into the 5 standard brief sections:
     A. What Changed (recent timeline activity)
     B. What Matters Today (outcome statement & health)
     C. Key Blockers & Gating Dependencies
     D. Proposed Daily Work Plan (sequenced work items with IST due dates)
     E. Evidence & Confidence Provenance
   - Format all dates, times, and milestone deadlines strictly in IST 24-hour clock notation (DD Mon YYYY, HH:MM IST).
   - Persist the brief and execution provenance into the shared timeline.
"""
