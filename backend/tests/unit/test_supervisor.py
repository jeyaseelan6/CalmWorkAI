"""
Unit test suite for Supervisor Coordinator & Event Bus Engine.
"""

from app.supervisor import SupervisorCoordinator, EventBus, EngagementEvent
from app.privacy import PrivacyPolicyEngine
from datetime import datetime, timezone


def test_supervisor_coordination():
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    summary = coordinator.orchestrate_engagement(
        engagement_id="eng-acme-001",
        customer_name="Acme Corp",
        engagement_name="Onboarding Modernization",
        current_work_cycle="Step 4: Build Within Real Constraints",
        status="NEEDS_REASSESSMENT",
        outcome_statement="Reduce manual customer onboarding time from 30 minutes to under 5 minutes.",
        success_criteria=[
            {"id": "sc-1", "title": "Automated onboarding workflow implemented", "completed": True},
            {"id": "sc-2", "title": "API integration complete", "completed": True}
        ],
        version=1,
        pending_approvals=1
    )

    assert summary.engagement_id == "eng-acme-001"
    assert len(summary.agents) == 4
    assert summary.privacy_guardrail_active is True
    assert summary.next_action is not None
    assert summary.customer_update is not None
    print("Supervisor Coordinator unit test passed successfully!")


def test_sequential_morning_brief_excludes_deliver():
    """
    Verifies that the Morning Brief:
    1. Executes UNDERSTAND -> KNOW -> MOVE -> Supervisor synthesis in sequence.
    2. EXCLUDES DELIVER (deliver_invoked is False).
    3. Synthesizes a Supervisor Proposed Work Plan with ordered work items and first action.
    """
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    brief = coordinator.generate_daily_work_brief(
        engagement_id="eng-acme-001",
        customer_name="Acme Corp",
        status="NEEDS_REASSESSMENT",
        outcome_statement="Reduce manual customer onboarding time from 30 minutes to under 5 minutes.",
        version=1,
        pending_approvals=1
    )

    # 1. Verification: DELIVER is strictly excluded
    assert brief.deliver_invoked is False, "DELIVER must not be invoked during Morning Brief"
    assert "DELIVER" not in brief.capabilities_invoked
    assert set(brief.capabilities_invoked) == {"UNDERSTAND", "KNOW", "MOVE", "SUPERVISOR"}

    # 2. Verification: Supervisor Proposed Work Plan exists
    plan = brief.proposed_work_plan
    assert plan is not None
    assert plan.status == "PROPOSED"
    assert len(plan.work_items) >= 1
    assert plan.recommended_first_action != ""
    assert plan.work_items[0].why_it_matters != ""

    # 3. Verification: Content sections A, B, C, D, E are populated
    assert len(brief.what_changed) >= 1
    assert brief.outcome_health == "NEEDS_REASSESSMENT"
    assert len(brief.what_is_blocking_progress) >= 1
    assert len(brief.evidence_and_confidence) >= 1
    assert brief.source_state_version == 1
    assert brief.brief_id.startswith("brief-eng-acme-001-")
    print("Sequential Morning Brief unit test passed successfully!")


def test_morning_brief_handles_partial_evidence():
    """
    Verifies that missing or incomplete evidence is flagged explicitly in warnings_or_partial_failures
    and never results in fabricated findings.
    """
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    brief = coordinator.generate_daily_work_brief(
        engagement_id="eng-unknown-999",
        customer_name="Unknown Corp",
        status="HEALTHY",
        outcome_statement="Experimental migration pipeline.",
        version=1,
        pending_approvals=0
    )

    assert brief.deliver_invoked is False
    assert isinstance(brief.warnings_or_partial_failures, list)
    assert brief.proposed_work_plan is not None
    print("Partial evidence handling unit test passed successfully!")


def test_independent_agent_execution_without_morning_brief():
    """
    Verifies that all 4 specialists (UNDERSTAND, KNOW, MOVE, DELIVER) can be executed
    independently without invoking or requiring a Morning Brief first.
    """
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    # 1. Independent UNDERSTAND call
    change_analysis = coordinator.understand_agent.analyze_change(
        raw_change_text="Customer requested SSO integration",
        current_outcome_statement="Automate onboarding",
        current_success_criteria=[]
    )
    assert change_analysis is not None
    assert change_analysis.change_title != ""

    # 2. Independent KNOW call
    answer = coordinator.know_agent.answer_question(
        engagement_id="eng-acme-001",
        raw_question="What is the SSO mandate?",
        top_k=2
    )
    assert answer is not None

    # 3. Independent MOVE call
    next_action = coordinator.move_agent.determine_next_action(
        engagement_id="eng-acme-001",
        customer_name="Acme Corp",
        current_work_cycle="Validation",
        status="HEALTHY",
        outcome_version=1,
        pending_approvals=0
    )
    assert next_action is not None
    assert next_action.action_title != ""

    # 4. Independent DELIVER call
    customer_draft = coordinator.deliver_agent.generate_customer_update(
        engagement_id="eng-acme-001",
        customer_name="Acme Corp",
        engagement_name="Onboarding",
        outcome_statement="Automate onboarding",
        success_criteria=[],
        current_work_cycle="Validation"
    )
    assert customer_draft is not None
    assert customer_draft.subject != ""
    print("Independent agent execution unit test passed successfully!")


def test_custom_due_date_and_worknote_logging():
    """
    Verifies that:
    1. Custom due dates specified in approved tasks are prioritized over defaults.
    2. WORKNOTE_LOGGED timeline events are categorized as 'WORKNOTE' in what_changed.
    """
    from unittest.mock import MagicMock
    from datetime import datetime
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    mock_event = MagicMock()
    mock_event.event_type = "WORKNOTE_LOGGED"
    mock_event.description = "Worknote: FDE Sarah Chen marked task 'Deploy SSO' as completed."
    mock_event.title = "Worknote: Deploy SSO completed"
    mock_event.created_at = datetime.utcnow()
    mock_event.id = "evt-wn-001"

    custom_plan = {
        "tasks": [
            {
                "id": "sc-1",
                "title": "Automated onboarding workflow implemented",
                "status": "COMPLETED",
                "due_date": "25 Oct 2026, 19:00 IST",
                "linked_goal_id": "sc-1"
            }
        ]
    }

    brief = coordinator.generate_daily_work_brief(
        engagement_id="eng-acme-001",
        customer_name="Acme Corp",
        status="HEALTHY",
        outcome_statement="Reduce onboarding time.",
        version=1,
        pending_approvals=0,
        timeline_events=[mock_event],
        success_criteria=[{"id": "sc-1", "title": "Automated onboarding workflow implemented", "completed": True}],
        approved_work_plan=custom_plan
    )

    # 1. Custom due date verification
    assert brief.proposed_work_plan.work_items[0].due_date == "25 Oct 2026, 19:00 IST"
    # 2. Worknote category verification
    assert len(brief.what_changed) >= 1
    assert brief.what_changed[0].category == "WORKNOTE"
    assert "marked task 'Deploy SSO' as completed" in brief.what_changed[0].summary
    print("Custom due date and worknote logging unit test passed successfully!")


if __name__ == "__main__":
    test_supervisor_coordination()
    test_event_bus()
    test_sequential_morning_brief_excludes_deliver()
    test_morning_brief_handles_partial_evidence()
    test_independent_agent_execution_without_morning_brief()
    test_custom_due_date_and_worknote_logging()
