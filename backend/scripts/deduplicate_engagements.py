"""
CalmWork AI — High-Performance Engagement Deduplication Script
Safely eliminates redundant engagement clones across the 13 unique enterprise accounts.
Preserves all documents, distinct outcomes, and canonical timeline events.
Uses bulk aggregate queries for lightning-fast execution over Cloud PostgreSQL.
"""

import os
import sys
import argparse
from collections import defaultdict
from dotenv import load_dotenv

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from app.db.database import SessionLocal, engine
from app.models import Engagement, Outcome, TimelineEvent, Approval, DocumentModel
from sqlalchemy import text

def plan_and_deduplicate(dry_run: bool = True):
    print("==================================================")
    print(f"Engagement Deduplication ({'DRY RUN' if dry_run else 'APPLYING CHANGES'})")
    print("==================================================")

    db = SessionLocal()
    try:
        # Pre-fetch child counts in 4 bulk queries
        with engine.connect() as conn:
            doc_counts = dict(conn.execute(text("SELECT engagement_id, COUNT(*) FROM documents GROUP BY engagement_id")).fetchall())
            evt_counts = dict(conn.execute(text("SELECT engagement_id, COUNT(*) FROM timeline_events GROUP BY engagement_id")).fetchall())
            out_counts = dict(conn.execute(text("SELECT engagement_id, COUNT(*) FROM outcomes GROUP BY engagement_id")).fetchall())
            app_counts = dict(conn.execute(text("SELECT engagement_id, COUNT(*) FROM approvals GROUP BY engagement_id")).fetchall())

        engagements = db.query(Engagement).order_by(Engagement.created_at.desc()).all()
        by_customer = defaultdict(list)
        for e in engagements:
            by_customer[e.customer_name.strip()].append(e)

        print(f"Total current engagements: {len(engagements)}")
        print(f"Unique customers: {len(by_customer)}")
        print("--------------------------------------------------")

        canonical_map = {} # customer_name -> canonical Engagement
        duplicates_to_delete = [] # list of Engagement objects to delete

        for customer_name, eng_list in by_customer.items():
            if len(eng_list) == 1:
                canonical_map[customer_name] = eng_list[0]
                continue

            scored = []
            for e in eng_list:
                doc_cnt = doc_counts.get(e.id, 0)
                evt_cnt = evt_counts.get(e.id, 0)
                out_cnt = out_counts.get(e.id, 0)
                app_cnt = app_counts.get(e.id, 0)
                score = (doc_cnt * 1000) + (app_cnt * 50) + (evt_cnt * 10) + (out_cnt * 5)
                scored.append((score, e.created_at, e, doc_cnt, evt_cnt, out_cnt, app_cnt))

            scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
            canonical = scored[0][2]
            canonical_map[customer_name] = canonical
            duplicates = [x[2] for x in scored[1:]]
            duplicates_to_delete.extend(duplicates)

            print(f"Customer '{customer_name}':")
            print(f"  -> Canonical: {canonical.id} (name='{canonical.name}', docs={scored[0][3]}, events={scored[0][4]}, outcomes={scored[0][5]})")
            print(f"  -> Clones to remove: {len(duplicates)}")

        print("--------------------------------------------------")
        print(f"Summary:")
        print(f"  Engagements before: {len(engagements)}")
        print(f"  Engagements after:  {len(canonical_map)}")
        print(f"  Clones to remove:   {len(duplicates_to_delete)}")
        print("--------------------------------------------------")

        if dry_run:
            print("[DRY RUN COMPLETE] No records were modified or deleted.")
            return

        # Perform execution in transaction
        print("Executing deduplication via atomic PostgreSQL transaction...")
        with engine.begin() as conn:
            for customer_name, canonical in canonical_map.items():
                other_ids = [d.id for d in by_customer[customer_name] if d.id != canonical.id]
                if not other_ids:
                    continue

                # 1. Re-link any documents from clones to canonical
                conn.execute(text("""
                    UPDATE documents
                    SET engagement_id = :canonical_id
                    WHERE engagement_id = ANY(:other_ids);
                """), {"canonical_id": canonical.id, "other_ids": other_ids})

                # 2. Re-link any approvals from clones to canonical
                conn.execute(text("""
                    UPDATE approvals
                    SET engagement_id = :canonical_id
                    WHERE engagement_id = ANY(:other_ids);
                """), {"canonical_id": canonical.id, "other_ids": other_ids})

                # 3. For outcomes: delete duplicate outcome statements, re-link unique ones
                conn.execute(text("""
                    DELETE FROM outcomes
                    WHERE engagement_id = ANY(:other_ids)
                    AND statement IN (
                        SELECT statement FROM outcomes WHERE engagement_id = :canonical_id
                    );
                """), {"canonical_id": canonical.id, "other_ids": other_ids})

                # Re-link any remaining outcomes
                conn.execute(text("""
                    UPDATE outcomes
                    SET engagement_id = :canonical_id
                    WHERE engagement_id = ANY(:other_ids);
                """), {"canonical_id": canonical.id, "other_ids": other_ids})

                # 4. Clean up timeline events of clones
                conn.execute(text("""
                    DELETE FROM timeline_events
                    WHERE engagement_id = ANY(:other_ids);
                """), {"other_ids": other_ids})

                # 5. Delete duplicate engagements
                conn.execute(text("""
                    DELETE FROM engagements
                    WHERE id = ANY(:other_ids);
                """), {"other_ids": other_ids})

                # 6. Ensure canonical has current_outcome_id set
                conn.execute(text("""
                    UPDATE engagements
                    SET current_outcome_id = (
                        SELECT id FROM outcomes WHERE engagement_id = :canonical_id ORDER BY created_at ASC LIMIT 1
                    )
                    WHERE id = :canonical_id AND (current_outcome_id IS NULL OR current_outcome_id = '');
                """), {"canonical_id": canonical.id})

        print("SUCCESS: Deduplication applied and committed to database.")

        with engine.connect() as conn:
            remaining_count = conn.execute(text("SELECT COUNT(*) FROM engagements;")).scalar()
            print(f"Remaining active engagements in database: {remaining_count}")

    except Exception as e:
        print(f"ERROR during deduplication: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deduplicate engagement records in CalmWork AI database.")
    parser.add_argument("--apply", action="store_true", help="Apply changes (default is dry run)")
    args = parser.parse_args()

    plan_and_deduplicate(dry_run=not args.apply)
