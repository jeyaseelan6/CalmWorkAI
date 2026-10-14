"""
Google Agent Development Kit (ADK) Runtime Layer for CalmWork AI.
Provides centralized model resolution, session persistence, runner orchestration,
and defense-in-depth Pre-LLM Privacy Guardrail callbacks.
"""

import os
import logging
from typing import Optional, Dict, Any, List
from google.adk.agents import Agent, BaseAgent
from google.adk.models.google_llm import Gemini
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService, DatabaseSessionService, BaseSessionService
from google.adk.models.llm_request import LlmRequest
from google.adk.agents.context import Context
from google.genai import types

from app.config import settings
from app.privacy.policy import PrivacyPolicyEngine, PrivacyViolationError
from app.ai.groq_service import groq_service

logger = logging.getLogger(__name__)


def get_adk_model() -> Any:
    """
    Resolves the ADK Gemini model connector based on active environment settings.
    Supports dual modes:
    1. Vertex AI (Enterprise GCP with Project ID + Location + ADC)
    2. Gemini Developer API (API Key mode for development and testing)
    """
    model_name = settings.GEMINI_MODEL

    if settings.USE_VERTEX_AI and settings.GCP_PROJECT_ID:
        logger.info(f"Initializing ADK Gemini model on Vertex AI (project={settings.GCP_PROJECT_ID}, location={settings.GCP_LOCATION})")
        return Gemini(
            model=model_name,
            client_kwargs={
                "vertexai": True,
                "project": settings.GCP_PROJECT_ID,
                "location": settings.GCP_LOCATION,
            }
        )

    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if api_key:
        return Gemini(
            model=model_name,
            client_kwargs={
                "api_key": api_key,
            }
        )

    # Fallback to model name string; ADK registry resolves via ambient credentials
    return model_name


def get_session_service(storage_type: Optional[str] = None) -> BaseSessionService:
    """
    Factory for ADK session persistence services.
    - InMemorySessionService: for fast ephemeral execution, local dev, and tests.
    - DatabaseSessionService: for persistent multi-turn state across restarts in PostgreSQL/SQLite.
    """
    mode = (storage_type or settings.ADK_SESSION_STORAGE).lower()
    if mode == "database" and settings.DATABASE_URL:
        db_url = settings.DATABASE_URL
        # Normalize sqlite url for aiosqlite if needed
        if db_url.startswith("sqlite:///"):
            async_db_url = db_url.replace("sqlite:///", "sqlite+aiosqlite:///")
        elif db_url.startswith("postgresql://"):
            async_db_url = db_url.replace("postgresql://", "postgresql+asyncpg:///")
        else:
            async_db_url = db_url

        try:
            logger.info("Initializing ADK DatabaseSessionService")
            return DatabaseSessionService(db_url=async_db_url)
        except Exception as e:
            logger.warning(f"DatabaseSessionService initialization failed ({e}); falling back to InMemorySessionService.")
            return InMemorySessionService()

    return InMemorySessionService()


def create_privacy_guardrail_callback(privacy_engine: PrivacyPolicyEngine):
    """
    ADK before_model_callback: Enforces defense-in-depth pre-LLM privacy verification.
    Inspects all Content parts heading to the model.
    If raw sensitive credentials, emails, or phone numbers are detected that were
    not de-identified by the privacy boundary, the invocation is immediately blocked.
    """
    def before_model_check(context: Context, llm_request: LlmRequest):
        if not settings.PRIVACY_GUARDRAIL_ENABLED:
            return None

        detector = privacy_engine.detector
        if not llm_request or not llm_request.contents:
            return None

        for content in llm_request.contents:
            if not content or not content.parts:
                continue
            for part in content.parts:
                text_content = getattr(part, "text", None)
                if not text_content:
                    continue

                # Run detector on model-bound text
                entities = detector.detect(text_content)
                if entities:
                    # Filter out reference tokens (e.g. [EMAIL_001], [CREDENTIAL_001])
                    unscrubbed = []
                    for ent in entities:
                        # If the detected entity is raw (not a reference token)
                        if not (ent.text.startswith("[") and ent.text.endswith("]")):
                            unscrubbed.append(ent)

                    if unscrubbed:
                        logger.error(
                            f"Privacy Guardrail BLOCKED model transit: Found {len(unscrubbed)} unscrubbed entities "
                            f"(types: {[e.entity_type for e in unscrubbed]}) in outbound ADK payload."
                        )
                        raise PrivacyViolationError(
                            "Privacy Guardrail Blocked Execution: Unsanitized sensitive entities detected "
                            "prior to model transit."
                        )

        return None

    return before_model_check


def create_adk_runner(
    agent: BaseAgent,
    session_service: Optional[BaseSessionService] = None,
    app_name: Optional[str] = None,
    auto_create_session: bool = True
) -> Runner:
    """
    Creates an ADK Runner configured for the given agent and session storage.
    """
    resolved_app_name = app_name or settings.ADK_APP_NAME
    resolved_session_service = session_service or get_session_service()

    return Runner(
        app_name=resolved_app_name,
        agent=agent,
        session_service=resolved_session_service,
        auto_create_session=auto_create_session
    )


# Registry for deterministic unit test mocking
_MOCK_ADK_RESPONSES: Dict[str, str] = {}


def set_mock_adk_response(pattern: str, response: str) -> None:
    """Registers a mocked ADK response for unit tests matching a prompt pattern."""
    _MOCK_ADK_RESPONSES[pattern.lower()] = response


def clear_mock_adk_responses() -> None:
    """Clears all registered mock responses."""
    _MOCK_ADK_RESPONSES.clear()


def is_live_inference_enabled() -> bool:
    """
    Returns True if live cloud inference should be attempted.
    In unit test runs (TESTING=1 or PYTEST_CURRENT_TEST), live calls are skipped
    unless explicitly opted in with RUN_LIVE_AI_TESTS=1.
    """
    is_testing = os.getenv("TESTING") == "1" or "PYTEST_CURRENT_TEST" in os.environ
    if is_testing and os.getenv("RUN_LIVE_AI_TESTS") != "1":
        return False
    return bool(
        settings.GEMINI_API_KEY or 
        settings.USE_VERTEX_AI or 
        os.getenv("GOOGLE_API_KEY") or 
        settings.GROQ_API_KEY
    )


def execute_adk_runner(
    runner: Runner,
    user_id: str,
    session_id: str,
    message_text: str,
    system_instruction: Optional[str] = None,
    json_mode: bool = False
) -> Optional[str]:
    """
    Executes an ADK Runner with input message and extracts the final text response.
    Catches errors safely without leaking sensitive information.
    Dual-mode orchestration:
    - Primary (Competition): Google Gemini / Vertex AI via native Google ADK Runner.
    - Fallback / Fast Prototyping (Testing): Groq API via GroqService.
    Supports deterministic test mocking.
    """
    # 1. Check for registered test mocks
    msg_lower = message_text.lower()
    for pattern, mock_resp in _MOCK_ADK_RESPONSES.items():
        if pattern in msg_lower:
            logger.info(f"Using registered ADK mock response for pattern: '{pattern}'")
            return mock_resp

    # 2. Check if live cloud inference is active
    if not is_live_inference_enabled():
        return None

    # 3. Primary Mode: Google Gemini / Vertex AI via native Google ADK Runner
    gemini_active = bool(settings.GEMINI_API_KEY or settings.USE_VERTEX_AI or os.getenv("GOOGLE_API_KEY"))
    if gemini_active:
        try:
            content = types.Content(
                parts=[types.Part.from_text(text=message_text)]
            )

            final_text = None
            for event in runner.run(
                user_id=user_id,
                session_id=session_id,
                new_message=content
            ):
                if event.is_final_response():
                    msg = event.message
                    if msg and msg.parts:
                        part_texts = [p.text for p in msg.parts if getattr(p, "text", None)]
                        if part_texts:
                            final_text = "\n".join(part_texts)
                    elif event.message and getattr(event.message, "text", None):
                        final_text = event.message.text

            if final_text:
                return final_text
        except Exception as e:
            logger.warning(f"Native Google ADK Runner execution failed ({e}); checking Groq fallback.")

    # 4. Testing / Fallback Mode: Groq Service
    if settings.GROQ_API_KEY:
        try:
            instruction = system_instruction or getattr(getattr(runner, "agent", None), "instruction", None)
            logger.info(f"Executing agent inference via Groq provider (model={settings.GROQ_MODEL or 'qwen/qwen3.8-27b'}, json_mode={json_mode})")
            groq_response = groq_service.generate_chat_completion(
                prompt=message_text,
                system_instruction=instruction,
                json_mode=json_mode,
                max_tokens=2048
            )
            if groq_response:
                return groq_response
        except Exception as e:
            logger.warning(f"Groq provider execution failed ({e}); falling back to deterministic reasoning.")

    return None
