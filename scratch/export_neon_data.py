"""
CalmWork AI - Database Migration Utility (Neon to Cloud SQL)
Extracts all tables and entities with zero data loss.
"""

import sys
import os
import json
from datetime import datetime

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from app.db.database import SessionLocal
from app.models import (
    Engagement, Outcome, TimelineEvent, Approval, DocumentModel, UserModel
)

def serialize_val(v):
    if isinstance(v, datetime):
        return v.isoformat()
    if hasattr(v, "value"):
        return v.value
    return v

def export_all():
    db = SessionLocal()
    try:
        users = [
            {c.name: serialize_val(getattr(u, c.name)) for c in UserModel.__table__.columns}
            for u in db.query(UserModel).all()
        ]
        engagements = [
            {c.name: serialize_val(getattr(e, c.name)) for c in Engagement.__table__.columns}
            for e in db.query(Engagement).all()
        ]
        outcomes = [
            {c.name: serialize_val(getattr(o, c.name)) for c in Outcome.__table__.columns}
            for o in db.query(Outcome).all()
        ]
        timeline = [
            {c.name: serialize_val(getattr(t, c.name)) for c in TimelineEvent.__table__.columns}
            for t in db.query(TimelineEvent).all()
        ]
        approvals = [
            {c.name: serialize_val(getattr(a, c.name)) for c in Approval.__table__.columns}
            for a in db.query(Approval).all()
        ]
        documents = [
            {c.name: serialize_val(getattr(d, c.name)) for c in DocumentModel.__table__.columns}
            for d in db.query(DocumentModel).all()
        ]

        data = {
            "exported_at": datetime.utcnow().isoformat(),
            "users": users,
            "engagements": engagements,
            "outcomes": outcomes,
            "timeline": timeline,
            "approvals": approvals,
            "documents": documents
        }

        output_path = os.path.join(os.path.dirname(__file__), "neon_backup.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        print(f"Exported successfully:")
        print(f"  Users: {len(users)}")
        print(f"  Engagements: {len(engagements)}")
        print(f"  Outcomes: {len(outcomes)}")
        print(f"  Timeline Events: {len(timeline)}")
        print(f"  Approvals: {len(approvals)}")
        print(f"  Documents: {len(documents)}")
        print(f"File saved to: {output_path}")

    finally:
        db.close()

if __name__ == "__main__":
    export_all()
