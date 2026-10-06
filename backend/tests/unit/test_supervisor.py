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


def test_event_bus():
    bus = EventBus()
    events_received = []

    bus.subscribe("REQUIREMENT_CHANGED", lambda e: events_received.append(e.event_id))

    bus.publish(EngagementEvent(
        event_id="evt-100",
        engagement_id="eng-acme-001",
        event_type="REQUIREMENT_CHANGED",
        payload={"note": "Enterprise SSO requirement added"},
        actor_id="fde_user_1",
        timestamp=datetime.now(timezone.utc).isoformat()
    ))

    assert len(events_received) == 1
    assert events_received[0] == "evt-100"
    print("EventBus unit test passed successfully!")


if __name__ == "__main__":
    test_supervisor_coordination()
    test_event_bus()
