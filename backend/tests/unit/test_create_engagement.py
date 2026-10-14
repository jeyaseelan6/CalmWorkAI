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


def test_fde_can_create_new_engagement():
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
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["customer_name"] == "Stark Industries"
    assert data["data"]["status"] == "HEALTHY"


def test_created_engagement_visible_in_engagements_list():
    response = client.get("/api/v1/engagements")
    assert response.status_code == 200
    names = [e["customer_name"] for e in response.json()["data"]]
    assert "Wayne Enterprises" in names
    assert "Stark Industries" in names


def test_manager_can_add_work_task():
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


def test_fde_can_add_plan_agent_tasks_without_manager_approval():
    fde_token = create_access_token({"sub": "fde@calmwork.ai", "role": "FDE"})
    headers = {"Authorization": f"Bearer {fde_token}"}
    
    # 1. Create engagement as FDE
    eng_res = client.post("/api/v1/engagements", json={
        "customer_name": "Cyberdyne Systems",
        "name": "Neural Network Safety"
    }, headers=headers)
    assert eng_res.status_code == 200
    eng_id = eng_res.json()["data"]["id"]

    # 2. FDE adds Plan Agent synthesized tasks in batch directly without manager approval
    plan_agent_tasks = [
        {"title": "Inspect neural architecture boundaries", "sequence_order": 1, "due_date": "15 Oct 2026, 18:00 IST"},
        {"title": "Implement fail-safe killswitch protocol", "sequence_order": 2, "due_date": "16 Oct 2026, 17:00 IST"}
    ]
    batch_res = client.post(f"/api/v1/engagements/{eng_id}/tasks", json={
        "tasks": plan_agent_tasks
    }, headers=headers)
    assert batch_res.status_code == 200
    b_data = batch_res.json()
    assert b_data["success"] is True
    assert len(b_data["data"]) == 2
    assert b_data["data"][0]["title"] == "Inspect neural architecture boundaries"


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

        # 1. Create engagement
        eng_res = client.post("/api/v1/engagements", json={
            "customer_name": "Pied Piper",
            "name": "Middle-Out Compression"
        }, headers={"Authorization": f"Bearer {mgr_token}"})
        eng_id = eng_res.json()["data"]["id"]

        # 2. DELIVER agent generates draft
        draft_res = client.post(f"/api/v1/engagements/{eng_id}/customer-updates/generate", json={
            "raw_notes": "Compression engine deployed. Weissman score 5.2 achieved."
        })
        assert draft_res.status_code == 200

        # 3. UNAPPROVED: Verify PDF download is blocked (returns 403)
        pdf_check_before = client.get(f"/api/v1/engagements/{eng_id}/customer-updates/pdf-status")
        assert pdf_check_before.status_code == 403
        assert "Manager approval required" in pdf_check_before.json()["detail"]

        # 4. FDE attempts to approve -> blocked (returns 403)
        fde_appr = client.post(
            f"/api/v1/engagements/{eng_id}/customer-updates/approve",
            headers={"Authorization": f"Bearer {fde_token}"},
            json={"action": "APPROVE"}
        )
        assert fde_appr.status_code == 403

        # 5. Manager approves customer update draft
        mgr_appr = client.post(
            f"/api/v1/engagements/{eng_id}/customer-updates/approve",
            headers={"Authorization": f"Bearer {mgr_token}"},
            json={"action": "APPROVE", "decision_note": "Approved for external delivery"}
        )
        assert mgr_appr.status_code == 200
        assert mgr_appr.json()["data"]["approved"] is True

        # 6. APPROVED: PDF download is now authorized!
        pdf_check_after = client.get(f"/api/v1/engagements/{eng_id}/customer-updates/pdf-status")
        assert pdf_check_after.status_code == 200
        assert pdf_check_after.json()["data"]["pdf_authorized"] is True
    finally:
        clear_mock_adk_responses()
