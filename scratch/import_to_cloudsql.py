"""
CalmWork AI - Database Import Utility
Restores exported data into a target database (Cloud SQL).
"""

import sys
import os
import json
from datetime import datetime

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Engagement, Outcome, TimelineEvent, Approval, DocumentModel, UserModel

def parse_iso(dt_str):
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except Exception:
        return None

def import_data(target_db_url: str):
    print(f"Connecting to target database...")
    engine = create_engine(target_db_url, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    backup_file = os.path.join(os.path.dirname(__file__), "neon_backup.json")
    with open(backup_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    try:
        # 1. Users
        for u in data.get("users", []):
            if not session.query(UserModel).filter(UserModel.id == u["id"]).first():
                session.add(UserModel(
                    id=u["id"],
                    email=u["email"],
                    password_hash=u["password_hash"],
                    name=u["name"],
                    role=u["role"],
                    title=u.get("title", ""),
                    created_at=parse_iso(u.get("created_at"))
                ))
        session.commit()
        print(f"Restored {len(data.get('users', []))} users.")

        # 2. Engagements (insert with current_outcome_id=None first to satisfy circular FK)
        for e in data.get("engagements", []):
            if not session.query(Engagement).filter(Engagement.id == e["id"]).first():
                session.add(Engagement(
                    id=e["id"],
                    customer_name=e["customer_name"],
                    name=e["name"],
                    description=e.get("description"),
                    status=e["status"],
                    current_work_cycle=e["current_work_cycle"],
                    progress=e.get("progress", 0),
                    current_outcome_id=None,
                    created_by=e.get("created_by"),
                    created_at=parse_iso(e.get("created_at")),
                    updated_at=parse_iso(e.get("updated_at"))
                ))
        session.commit()
        print(f"Restored {len(data.get('engagements', []))} engagements (skeleton).")

        # 3. Outcomes
        for o in data.get("outcomes", []):
            if not session.query(Outcome).filter(Outcome.id == o["id"]).first():
                session.add(Outcome(
                    id=o["id"],
                    engagement_id=o["engagement_id"],
                    version=o["version"],
                    statement=o["statement"],
                    success_criteria=o.get("success_criteria"),
                    work_plan=o.get("work_plan"),
                    status=o["status"],
                    created_by=o.get("created_by"),
                    approved_by=o.get("approved_by"),
                    created_at=parse_iso(o.get("created_at")),
                    approved_at=parse_iso(o.get("approved_at"))
                ))
        session.commit()
        print(f"Restored {len(data.get('outcomes', []))} outcomes.")

        # Update Engagements with real current_outcome_id
        for e in data.get("engagements", []):
            if e.get("current_outcome_id"):
                eng = session.query(Engagement).filter(Engagement.id == e["id"]).first()
                if eng:
                    eng.current_outcome_id = e["current_outcome_id"]
        session.commit()
        print("Updated engagements with current_outcome_id.")

        # 4. Timeline Events
        for t in data.get("timeline", []):
            if not session.query(TimelineEvent).filter(TimelineEvent.id == t["id"]).first():
                session.add(TimelineEvent(
                    id=t["id"],
                    engagement_id=t["engagement_id"],
                    event_type=t["event_type"],
                    title=t["title"],
                    description=t["description"],
                    actor_type=t.get("actor_type"),
                    actor_id=t.get("actor_id"),
                    metadata_json=t.get("metadata_json"),
                    created_at=parse_iso(t.get("created_at"))
                ))
        session.commit()
        print(f"Restored {len(data.get('timeline', []))} timeline events.")

        # 5. Approvals
        for a in data.get("approvals", []):
            if not session.query(Approval).filter(Approval.id == a["id"]).first():
                session.add(Approval(
                    id=a["id"],
                    engagement_id=a["engagement_id"],
                    type=a["type"],
                    target_id=a.get("target_id"),
                    status=a["status"],
                    requested_by=a["requested_by"],
                    reviewed_by=a.get("reviewed_by"),
                    decision_note=a.get("decision_note"),
                    reviewed_at=parse_iso(a.get("reviewed_at")),
                    created_at=parse_iso(a.get("created_at"))
                ))
        session.commit()
        print(f"Restored {len(data.get('approvals', []))} approvals.")

        # 6. Documents
        for d in data.get("documents", []):
            if not session.query(DocumentModel).filter(DocumentModel.id == d["id"]).first():
                session.add(DocumentModel(
                    id=d["id"],
                    engagement_id=d["engagement_id"],
                    title=d["title"],
                    category=d["category"],
                    status=d["status"],
                    content=d.get("content"),
                    file_url=d.get("file_url"),
                    chunks_count=d.get("chunks_count", 0),
                    uploaded_by=d.get("uploaded_by", "system"),
                    created_at=parse_iso(d.get("created_at")),
                    updated_at=parse_iso(d.get("updated_at")) or parse_iso(d.get("created_at"))
                ))
        session.commit()
        print(f"Restored {len(data.get('documents', []))} documents.")

        print("All data successfully restored into target database!")
    finally:
        session.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_url = sys.argv[1]
    else:
        target_url = os.getenv("TARGET_DATABASE_URL")
    if not target_url:
        print("Usage: python scratch/import_to_cloudsql.py <TARGET_DATABASE_URL>")
        sys.exit(1)
    import_data(target_url)
