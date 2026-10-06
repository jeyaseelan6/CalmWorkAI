from sqlalchemy import Column, String, Integer, DateTime, Enum, Text, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import enum

Base = declarative_base()


class EngagementStatus(str, enum.Enum):
    HEALTHY = "HEALTHY"
    NEEDS_REASSESSMENT = "NEEDS_REASSESSMENT"
    BLOCKED = "BLOCKED"
    AT_RISK = "AT_RISK"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"


class WorkCycleStep(str, enum.Enum):
    STEP_1_UNDERSTAND_BUSINESS_REALITY = "Step 1: Understand the Business Reality"
    STEP_2_DEFINE_RIGHT_PROBLEM = "Step 2: Define the Right Problem"
    STEP_3_DESIGN_AI_APPROACH = "Step 3: Design the AI Approach"
    STEP_4_BUILD_WITHIN_CONSTRAINTS = "Step 4: Build Within Real Constraints"
    STEP_5_DEPLOY_INTO_PRODUCTION = "Step 5: Deploy Into Production"
    STEP_6_OWN_OUTCOMES_AND_IMPROVE = "Step 6: Own Outcomes and Improve"


class Engagement(Base):
    __tablename__ = "engagements"

    id = Column(String(50), primary_key=True)
    customer_name = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(EngagementStatus), default=EngagementStatus.HEALTHY, nullable=False)
    current_work_cycle = Column(Enum(WorkCycleStep), default=WorkCycleStep.STEP_1_UNDERSTAND_BUSINESS_REALITY, nullable=False)
    progress = Column(Integer, default=0, nullable=False)
    current_outcome_id = Column(String(50), nullable=True)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
