"""
Morning Brief Agentic Skill — Automated 8:00 AM IST Scheduler.
Manages automated daily background execution at 08:00 AM IST (02:30 UTC)
and handles graceful lifecycle startup and shutdown.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.agents.invariants import IST_TZ
from app.db.database import SessionLocal
from app.skills.morning_brief.executor import morning_brief_skill

logger = logging.getLogger(__name__)

_scheduler_task: Optional[asyncio.Task] = None
_is_running: bool = False


def compute_seconds_until_8am_ist() -> float:
    """
    Computes the exact number of seconds remaining until the next 08:00 AM IST.
    08:00 AM IST corresponds to 02:30 AM UTC.
    """
    now_ist = datetime.now(timezone.utc).astimezone(IST_TZ)
    target_today = now_ist.replace(hour=8, minute=0, second=0, microsecond=0)

    if now_ist >= target_today:
        target_next = target_today + timedelta(days=1)
    else:
        target_next = target_today

    delta = (target_next - now_ist).total_seconds()
    return max(0.0, delta)


async def _morning_brief_scheduler_loop():
    """
    Background worker loop: sleeps until 08:00 AM IST every day and executes the Morning Brief skill.
    """
    global _is_running
    logger.info("Morning Brief Skill background scheduler started (Schedule: 08:00 AM IST / 02:30 UTC).")

    while _is_running:
        delay = compute_seconds_until_8am_ist()
        next_run_time = (datetime.now(timezone.utc).astimezone(IST_TZ) + timedelta(seconds=delay)).strftime("%d %b %Y, %H:%M IST")
        logger.info(f"Next Morning Brief Skill auto-run scheduled in {int(delay)} seconds at {next_run_time}.")

        try:
            await asyncio.sleep(delay)
        except asyncio.CancelledError:
            logger.info("Morning Brief Skill scheduler task cancelled.")
            break

        if not _is_running:
            break

        logger.info("Triggering automated 08:00 AM IST Morning Brief Skill batch execution...")
        db = SessionLocal()
        try:
            # Run batch execution asynchronously to not block the event loop
            await asyncio.to_thread(
                morning_brief_skill.execute_batch,
                db=db,
                trigger_source="SCHEDULED_8AM_IST"
            )
        except Exception as e:
            logger.error(f"Error during 08:00 AM IST Morning Brief batch execution: {e}")
        finally:
            db.close()

        # Brief sleep to ensure we don't double-trigger on the exact second boundary
        await asyncio.sleep(10)


def start_morning_brief_scheduler():
    """Starts the 08:00 AM IST scheduler background task."""
    global _scheduler_task, _is_running
    if _scheduler_task is not None and not _scheduler_task.done():
        logger.warning("Morning Brief Skill scheduler is already running.")
        return

    _is_running = True
    try:
        loop = asyncio.get_running_loop()
        _scheduler_task = loop.create_task(_morning_brief_scheduler_loop())
    except RuntimeError:
        logger.warning("No running asyncio event loop; scheduler task will initialize on app lifespan.")


def stop_morning_brief_scheduler():
    """Stops the scheduler background task."""
    global _scheduler_task, _is_running
    _is_running = False
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("Morning Brief Skill scheduler stopped.")
