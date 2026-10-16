import logging
from typing import Optional, Dict, Any, List
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqService:
    """
    Modular Groq AI Provider.
    Executes fast inference using OpenAI-compatible Groq completions API.
    Designed for seamless hot-swapping with Google Gemini / Vertex AI.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self._api_key = api_key
        self._model = model

    @property
    def api_key(self) -> Optional[str]:
        return self._api_key or settings.GROQ_API_KEY

    @property
    def model(self) -> str:
        return self._model or settings.GROQ_MODEL or "openai/gpt-oss-120b"

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def generate_chat_completion(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        json_mode: bool = False,
        max_tokens: Optional[int] = 2048
    ) -> Optional[str]:
        """
        Executes a chat completion against Groq API.
        Automatically falls back across accessible models on 429 rate limit.
        Returns the text response string or None if failed.
        """
        if not self.is_configured():
            logger.warning("GroqService called but GROQ_API_KEY is not configured.")
            return None

        final_sys = system_instruction or ""
        if json_mode and "json" not in final_sys.lower() and "json" not in prompt.lower():
            final_sys += "\nYou must output your response in valid JSON format only."

        messages: List[Dict[str, str]] = []
        if final_sys.strip():
            messages.append({"role": "system", "content": final_sys.strip()})
        messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Try configured model, fallback to alternative models if rate-limited (429)
        candidate_models = [self.model, "qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
        seen_models = set()
        models_to_try = []
        for m in candidate_models:
            if m and m not in seen_models:
                models_to_try.append(m)
                seen_models.add(m)

        for candidate in models_to_try:
            payload: Dict[str, Any] = {
                "model": candidate,
                "messages": messages,
                "temperature": 0.2,
                "max_tokens": max_tokens or 2048
            }
            if json_mode:
                payload["response_format"] = {"type": "json_object"}

            try:
                with httpx.Client(timeout=30.0) as client:
                    res = client.post(GROQ_API_URL, headers=headers, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        choices = data.get("choices", [])
                        if choices and "message" in choices[0]:
                            return choices[0]["message"].get("content", "")
                    elif res.status_code == 429:
                        logger.warning(f"Groq model {candidate} hit rate limit (429), trying next fallback model...")
                        continue
                    else:
                        logger.warning(
                            f"Groq API returned status {res.status_code} for model {candidate}: {res.text[:200]}"
                        )
                        continue
            except Exception as e:
                logger.warning(f"Groq API invocation failed for {candidate}: {str(e)}")
                continue

        return None


groq_service = GroqService()
