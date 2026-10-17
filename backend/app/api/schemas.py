"""
Shared Pydantic Schemas for CalmWork API.
"""

from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class LoginRequest(BaseModel):
    email: str
    password: str


class ChangeAnalysisRequest(BaseModel):
    raw_change_text: str
    session_id: Optional[str] = None


class ApprovalResponseRequest(BaseModel):
    action: str  # "APPROVE" | "REJECT"
    actor_id: str = "manager_user_1"
    decision_note: Optional[str] = None


class IngestDocumentRequest(BaseModel):
    title: str
    category: str = "Technical Documentation"
    content: str


class KnowledgeQueryRequest(BaseModel):
    question: str
    top_k: int = 3


class CreateEngagementRequest(BaseModel):
    customer_name: str
    name: str
    description: Optional[str] = ""
    initial_outcome_statement: Optional[str] = ""
    success_criteria: Optional[List[str]] = []


class GenerateCustomerUpdateRequest(BaseModel):
    raw_notes: Optional[str] = None
    format_type: str = "EXECUTIVE_SUMMARY"


class SubmitCustomerUpdateRequest(BaseModel):
    subject: str
    executive_summary: str
    key_milestones_achieved: List[str] = []
    next_milestone_target: Optional[str] = ""
    customer_action_items: List[str] = []
    format_type: str = "EXECUTIVE_SUMMARY"
    privacy_scrubbed: bool = True


class ProposeWorkPlanRequest(BaseModel):
    natural_language_description: str
    session_id: Optional[str] = None


class ApproveWorkPlanRequest(BaseModel):
    plan: Dict[str, Any]
    actor_id: Optional[str] = None
    decision_note: Optional[str] = None
    idempotency_key: Optional[str] = None


class UniversalSupervisorQueryPayload(BaseModel):
    query: str


class WorknotePayload(BaseModel):
    event_type: str = "WORKNOTE"  # WORKNOTE, CUSTOMER_INPUT, DECISION, OBSERVATION, PROGRESS
    title: str
    description: str
    actor_name: str = "FDE User"


class SupportInvestigationRequest(BaseModel):
    issue_description: str
    error_logs: Optional[str] = None
    screenshot_metadata: Optional[Dict[str, Any]] = None
    screenshot_base64: Optional[str] = None
    session_id: Optional[str] = None


class PlanReassessmentRequest(BaseModel):
    new_evidence_items: List[str] = []
    worknotes: Optional[List[str]] = None
    session_id: Optional[str] = None
