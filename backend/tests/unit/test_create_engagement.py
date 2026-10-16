import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_access_token

client = TestClient(app)


def test_manager_can_create_new_engagement():
    manager_token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    headers = {"Authorization": f"Bearer {manager_token}"}
    payload = {
        "customer_name": "Wayne Enterprises",
        "name": "Cloud Security Ingestion",
        "description": "Real-time telemetry and compliance pipeline",
        "initial_outcome_statement": "Automate compliance validation with 99.9% uptime.",
        "success_criteria": ["Ingestion ready", "Security validated"]
    }
    
    response = client.post("/api/v1/engagements", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["customer_name"] == "Wayne Enterprises"
    assert data["data"]["status"] == "HEALTHY"
    assert data["data"]["version"] == 1


def test_fde_cannot_create_new_engagement():
    """FDEs are restricted from creating new customer engagements (Manager only)."""
    fde_token = create_access_token({"sub": "fde@calmwork.ai", "role": "FDE"})
    headers = {"Authorization": f"Bearer {fde_token}"}
    payload = {
        "customer_name": "Stark Industries",
        "name": "Arc Reactor Telemetry",
        "description": "Telemetry and metrics pipeline for clean energy",
        "initial_outcome_statement": "Automate grid telemetry with real-time alerting.",
        "success_criteria": ["Sensors integrated", "Alerts configured"]
    }
    
    response = client.post("/api/v1/engagements", json=payload, headers=headers)
    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]


def test_created_engagement_visible_in_engagements_list():
    manager_token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    client.post("/api/v1/engagements", json={
        "customer_name": "Stark Industries",
        "name": "Arc Reactor Telemetry"
    }, headers={"Authorization": f"Bearer {manager_token}"})

    response = client.get("/api/v1/engagements")
    assert response.status_code == 200
    names = [e["customer_name"] for e in response.json()["data"]]
    assert "Wayne Enterprises" in names
    assert "Stark Industries" in names


def test_manager_can_add_work_task():
    """Manager creates work task directly as approved work."""
    manager_token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    headers = {"Authorization": f"Bearer {manager_token}"}
    
    # 1. Create engagement
    eng_res = client.post("/api/v1/engagements", json={
        "customer_name": "Oscorp Labs",
        "name": "Materials Pipeline"
    }, headers=headers)
    assert eng_res.status_code == 200
    eng_id = eng_res.json()["data"]["id"]

    # 2. Manager adds work task directly
    task_res = client.post(f"/api/v1/engagements/{eng_id}/tasks", json={
        "title": "Validate stress test criteria with lab technicians",
        "description": "High temperature stress testing",
        "due_date": "16 Oct 2026, 18:00 IST",
        "status": "TODO"
    }, headers=headers)
    assert task_res.status_code == 200
    t_data = task_res.json()
    assert t_data["success"] is True
    assert t_data["data"]["title"] == "Validate stress test criteria with lab technicians"
    assert t_data["data"]["approval_status"] == "APPROVED"


def test_fde_task_creation_requires_manager_approval():
    """FDE creates task; must be submitted for manager approval before becoming approved work."""
    mgr_token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    fde_token = create_access_token({"sub": "fde@calmwork.ai", "role": "FDE"})
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}
    fde_headers = {"Authorization": f"Bearer {fde_token}"}
    
    # 1. Manager creates engagement
    eng_res = client.post("/api/v1/engagements", json={
        "customer_name": "Cyberdyne Systems",
        "name": "Neural Network Safety"
    }, headers=mgr_headers)
    assert eng_res.status_code == 200
    eng_id = eng_res.json()["data"]["id"]

    # 2. FDE adds routine task -> submitted for manager approval
    task_res = client.post(f"/api/v1/engagements/{eng_id}/tasks", json={
        "title": "Inspect neural architecture boundaries",
        "description": "Examine memory layout",
        "due_date": "16 Oct 2026, 18:00 IST",
        "status": "TODO"
    }, headers=fde_headers)
    assert task_res.status_code == 200
    t_data = task_res.json()
    assert t_data["data"]["approval_status"] == "PENDING_APPROVAL"
    task_id = t_data["data"]["id"]

    # 3. Verify task cannot be marked completed while pending manager approval
    toggle_res = client.patch(f"/api/v1/engagements/{eng_id}/tasks/{task_id}", json={
        "status": "COMPLETED"
    }, headers=fde_headers)
    assert toggle_res.status_code == 400
    assert "pending manager approval" in toggle_res.json()["detail"]

    # 4. Pending approvals queue includes the task
    appr_res = client.get("/api/v1/approvals")
    assert appr_res.status_code == 200
    task_apprs = [a for a in appr_res.json()["data"] if a.get("type") == "TASK_CREATION"]
    assert len(task_apprs) > 0
    target_appr = next((a for a in task_apprs if a["engagement_id"] == eng_id), None)
    assert target_appr is not None

    # 5. Manager approves task
    respond_res = client.post(
        f"/api/v1/approvals/{target_appr['id']}/respond",
        json={"action": "APPROVE", "decision_note": "Task approved for sprint execution."},
        headers=mgr_headers
    )
    assert respond_res.status_code == 200
    assert respond_res.json()["data"]["status"] == "APPROVED"

    # 6. Now task is approved and can be marked as COMPLETED
    toggle_after = client.patch(f"/api/v1/engagements/{eng_id}/tasks/{task_id}", json={
        "status": "COMPLETED"
    }, headers=fde_headers)
    assert toggle_after.status_code == 200
    assert toggle_after.json()["data"]["status"] == "COMPLETED"


def test_manager_and_fde_shared_permissions():
    """Both Manager and FDE can upload engagement documents and add work notes."""
    mgr_token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    fde_token = create_access_token({"sub": "fde@calmwork.ai", "role": "FDE"})
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}
    fde_headers = {"Authorization": f"Bearer {fde_token}"}

    eng_res = client.post("/api/v1/engagements", json={
        "customer_name": "Shared Permissions Corp",
        "name": "Integration Hub"
    }, headers=mgr_headers)
    eng_id = eng_res.json()["data"]["id"]

    # 1. FDE records worknote
    fde_note = client.post(f"/api/v1/engagements/{eng_id}/timeline/worknotes", json={
        "title": "Configured database cluster",
        "description": "Primary and replica databases healthy.",
        "event_type": "WORKNOTE",
        "actor_name": "Sarah Chen"
    }, headers=fde_headers)
    assert fde_note.status_code == 200
    assert fde_note.json()["success"] is True

    # 2. Manager records worknote
    mgr_note = client.post(f"/api/v1/engagements/{eng_id}/timeline/worknotes", json={
        "title": "Stakeholder sync aligned",
        "description": "Sprint milestones confirmed.",
        "event_type": "WORKNOTE",
        "actor_name": "David Miller"
    }, headers=mgr_headers)
    assert mgr_note.status_code == 200
    assert mgr_note.json()["success"] is True

    # 3. FDE uploads document
    fde_doc = client.post(f"/api/v1/engagements/{eng_id}/documents/upload", json={
        "title": "System Architecture v1",
        "content": "PostgreSQL relational DB and Redis cache architecture specifications.",
        "category": "Architecture"
    }, headers=fde_headers)
    assert fde_doc.status_code == 200
    assert fde_doc.json()["success"] is True

    # 4. Manager uploads document
    mgr_doc = client.post(f"/api/v1/engagements/{eng_id}/documents/upload", json={
        "title": "Security Compliance Requirements",
        "content": "SOC2 and GDPR compliance criteria for customer integration.",
        "category": "Customer Requirements"
    }, headers=mgr_headers)
    assert mgr_doc.status_code == 200
    assert mgr_doc.json()["success"] is True


def test_deliver_agent_report_pdf_strictly_gated_by_manager_approval():
    from app.agents.adk_runtime import set_mock_adk_response, clear_mock_adk_responses
    import json

    mock_resp = json.dumps({
        "subject": "Executive Update: Pied Piper — Progress",
        "executive_summary": "Compression engine deployed. Weissman score 5.2 achieved.",
        "key_milestones_achieved": ["Middle-out core engine operational"],
        "next_milestone_target": "Kernel driver optimization.",
        "customer_action_items": ["Review milestone metrics."]
    })
    set_mock_adk_response("engineer notes", mock_resp)
    set_mock_adk_response("target outcome", mock_resp)

    try:
        fde_token = create_access_token({"sub": "fde@calmwork.ai", "role": "FDE"})
        mgr_token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
        fde_headers = {"Authorization": f"Bearer {fde_token}"}
        mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

        # 1. Create engagement as Manager
        eng_res = client.post("/api/v1/engagements", json={
            "customer_name": "Pied Piper",
            "name": "Middle-Out Compression"
        }, headers=mgr_headers)
        eng_id = eng_res.json()["data"]["id"]

        # 2. DELIVER agent generates draft as FDE (must submit for manager review)
        draft_res = client.post(f"/api/v1/engagements/{eng_id}/customer-updates/generate", json={
            "raw_notes": "Compression engine deployed. Weissman score 5.2 achieved."
        }, headers=fde_headers)
        assert draft_res.status_code == 200

        # 3. UNAPPROVED: Verify PDF download is blocked (returns 403)
        pdf_check_before = client.get(
            f"/api/v1/engagements/{eng_id}/customer-updates/pdf-status",
            headers=fde_headers
        )
        assert pdf_check_before.status_code == 403
        assert "Manager approval required" in pdf_check_before.json()["detail"]

        # 4. FDE attempts to approve -> blocked (returns 403)
        fde_appr = client.post(
            f"/api/v1/engagements/{eng_id}/customer-updates/approve",
            headers=fde_headers,
            json={"action": "APPROVE"}
        )
        assert fde_appr.status_code == 403

        # 5. Manager approves customer update draft
        mgr_appr = client.post(
            f"/api/v1/engagements/{eng_id}/customer-updates/approve",
            headers=mgr_headers,
            json={"action": "APPROVE", "decision_note": "Approved for external delivery"}
        )
        assert mgr_appr.status_code == 200
        assert mgr_appr.json()["data"]["approved"] is True

        # 6. APPROVED: PDF download is now authorized!
        pdf_check_after = client.get(
            f"/api/v1/engagements/{eng_id}/customer-updates/pdf-status",
            headers=fde_headers
        )
        assert pdf_check_after.status_code == 200
        assert pdf_check_after.json()["data"]["pdf_authorized"] is True
    finally:
        clear_mock_adk_responses()


def test_manager_can_delete_engagement_and_cascades_all_related_data():
    """
    Manager permanently deletes customer engagement.
    System must cascade and delete all related outcomes, approvals, documents, and timeline events.
    """
    from app.db.database import SessionLocal
    from app.models import Outcome, Approval, DocumentModel, TimelineEvent, Engagement

    mgr_token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    # 1. Create engagement with initial outcome
    eng_res = client.post("/api/v1/engagements", json={
        "customer_name": "Massive Dynamic",
        "name": "Cortex Sensor Array",
        "description": "Multi-spectrum sensor integration",
        "initial_outcome_statement": "Deploy sensor array to staging by EOD.",
        "success_criteria": ["Sensors online", "Diagnostics green"]
    }, headers=mgr_headers)
    assert eng_res.status_code == 200
    eng_id = eng_res.json()["data"]["id"]

    # 2. Add an approved task
    client.post(f"/api/v1/engagements/{eng_id}/tasks", json={
        "title": "Calibrate optical sensors",
        "due_date": "17 Oct 2026, 18:00 IST",
        "status": "TODO"
    }, headers=mgr_headers)

    # 3. Add a timeline event
    client.post(f"/api/v1/engagements/{eng_id}/worknotes", json={
        "content": "Optical sensors delivered to staging facility.",
        "author": "David Miller",
        "author_role": "MANAGER"
    }, headers=mgr_headers)

    # 4. Verify entities exist in database before deletion
    db = SessionLocal()
    try:
        assert db.query(Engagement).filter(Engagement.id == eng_id).count() == 1
        assert db.query(Outcome).filter(Outcome.engagement_id == eng_id).count() >= 1
        assert db.query(TimelineEvent).filter(TimelineEvent.engagement_id == eng_id).count() >= 1
    finally:
        db.close()

    # 5. Manager deletes engagement
    del_res = client.delete(f"/api/v1/engagements/{eng_id}", headers=mgr_headers)
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["success"] is True
    assert del_data["data"]["engagement_id"] == eng_id
    assert "deleted_counts" in del_data["data"]

    # 6. Verify engagement no longer exists in GET endpoint
    get_res = client.get(f"/api/v1/engagements/{eng_id}", headers=mgr_headers)
    assert get_res.status_code == 404

    # 7. Verify all related entities are purged from database (no orphans)
    db = SessionLocal()
    try:
        assert db.query(Engagement).filter(Engagement.id == eng_id).count() == 0
        assert db.query(Outcome).filter(Outcome.engagement_id == eng_id).count() == 0
        assert db.query(Approval).filter(Approval.engagement_id == eng_id).count() == 0
        assert db.query(DocumentModel).filter(DocumentModel.engagement_id == eng_id).count() == 0
        assert db.query(TimelineEvent).filter(TimelineEvent.engagement_id == eng_id).count() == 0
    finally:
        db.close()


def test_fde_cannot_delete_engagement():
    """FDEs are strictly forbidden from deleting customer engagements (Manager only)."""
    mgr_token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    fde_token = create_access_token({"sub": "fde@calmwork.ai", "role": "FDE"})
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}
    fde_headers = {"Authorization": f"Bearer {fde_token}"}

    # 1. Manager creates engagement
    eng_res = client.post("/api/v1/engagements", json={
        "customer_name": "Initech Corp",
        "name": "TPS Automated Reporting"
    }, headers=mgr_headers)
    assert eng_res.status_code == 200
    eng_id = eng_res.json()["data"]["id"]

    # 2. FDE attempts to delete engagement -> 403 Forbidden
    del_res = client.delete(f"/api/v1/engagements/{eng_id}", headers=fde_headers)
    assert del_res.status_code == 403
    assert "Access denied" in del_res.json()["detail"]

    # 3. Clean up by manager
    cleanup_res = client.delete(f"/api/v1/engagements/{eng_id}", headers=mgr_headers)
    assert cleanup_res.status_code == 200


