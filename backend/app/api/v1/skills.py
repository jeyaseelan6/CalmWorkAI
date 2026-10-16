"""
Agentic Skills API Endpoints (/api/v1/skills).
Provides skill discovery, on-demand execution, real-time SSE streaming,
cached latest briefing retrieval, and scheduled batch trigger endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import asyncio
import json
import logging
from typing import Dict, Any, List

from app.db.database import get_db
from app.models import Engagement
from app.skills import (
    morning_brief_skill,
    morning_brief_manifest,
    SKILLS_REGISTRY
)
from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skills", tags=["Skills"])


@router.get("")
@router.get("/")
def list_available_skills():
    """List all registered agentic AI skills and their manifests."""
    skills_list = []
    for s_id, s_info in SKILLS_REGISTRY.items():
        skills_list.append(s_info["manifest"].model_dump())
    return {
        "success": True,
        "data": skills_list,
        "message": "Registered agentic skills retrieved successfully."
    }


@router.get("/morning-brief/manifest")
def get_morning_brief_manifest():
    """Retrieve declarative manifest for Morning Brief Skill."""
    return {
        "success": True,
        "data": morning_brief_manifest.model_dump(),
        "message": "Morning Brief Skill manifest retrieved."
    }


@router.get("/morning-brief/latest/{engagement_id}")
def get_latest_morning_brief(
    engagement_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieves the most recent persisted Morning Brief for an engagement.
    Enables zero-latency morning dashboard rendering.
    """
    latest = morning_brief_skill.get_latest_brief(engagement_id=engagement_id, db=db)
    if not latest:
        return {
            "success": True,
            "data": None,
            "has_brief": False,
            "message": "No previously generated morning brief found for this engagement."
        }
    return {
        "success": True,
        "data": latest,
        "has_brief": True,
        "message": "Latest morning brief retrieved successfully."
    }


@router.post("/morning-brief/execute/{engagement_id}")
def execute_morning_brief_skill_on_demand(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Executes Morning Brief Skill on-demand for an engagement and persists results.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    try:
        user_name = current_user.get("name", "Engineer")
        brief = morning_brief_skill.execute_and_persist(
            engagement_id=engagement_id,
            db=db,
            trigger_source=f"ON_DEMAND ({user_name})"
        )
        return {
            "success": True,
            "data": brief.model_dump(),
            "message": "Morning Brief Skill executed successfully on-demand."
        }
    except Exception as e:
        logger.error(f"Error executing Morning Brief Skill: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute Morning Brief Skill: {str(e)}"
        )


@router.post("/morning-brief/execute/{engagement_id}/stream")
async def execute_morning_brief_skill_stream(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Executes Morning Brief Skill with real-time SSE progress streaming.
    """
    eng = await asyncio.to_thread(lambda: db.query(Engagement).filter(Engagement.id == engagement_id).first())
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    user_name = current_user.get("name", "Engineer")
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def sync_progress_callback(event: Dict[str, Any]):
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def event_generator():
        async def run_worker():
            try:
                brief = await asyncio.to_thread(
                    morning_brief_skill.execute_and_persist,
                    engagement_id=engagement_id,
                    db=db,
                    trigger_source=f"ON_DEMAND ({user_name})",
                    progress_callback=sync_progress_callback
                )
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {"type": "complete", "success": True, "data": brief.model_dump()}
                )
            except Exception as e:
                logger.error(f"Error during streamed Morning Brief Skill: {str(e)}")
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {"type": "error", "detail": f"Skill execution failed: {str(e)}"}
                )
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        worker_task = asyncio.create_task(run_worker())

        try:
            yield ": connected\n\n"
            await asyncio.sleep(0)

            while True:
                item = await queue.get()
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"
                await asyncio.sleep(0)
        finally:
            if not worker_task.done():
                worker_task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/morning-brief/trigger-batch")
async def trigger_morning_brief_batch(
    db: Session = Depends(get_db)
):
    """
    Webhook endpoint for Google Cloud Scheduler (or internal cron) to execute
    the Morning Brief Skill across all active engagements at 08:00 AM IST.
    """
    logger.info("Batch trigger received for Morning Brief Skill.")
    results = await asyncio.to_thread(
        morning_brief_skill.execute_batch,
        db=db,
        trigger_source="SCHEDULED_8AM_IST"
    )
    return {
        "success": True,
        "processed_count": len(results),
        "data": results,
        "message": f"Morning Brief Skill batch executed across {len(results)} engagements."
    }
