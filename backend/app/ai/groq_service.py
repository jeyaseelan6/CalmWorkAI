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
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_MODEL or "qwen/qwen3.8-27b"

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def generate_chat_completion(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        json_mode: bool = False,
        max_tokens: Optional[int] = 700
    ) -> Optional[str]:
        """
        Executes a chat completion against Groq API.
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

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": max_tokens or 700
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(GROQ_API_URL, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        return choices[0]["message"].get("content", "")
                else:
                    logger.warning(
                        f"Groq API returned status {res.status_code}: {res.text[:200]}"
                    )
                    return None
        except Exception as e:
            logger.warning(f"Groq API invocation failed: {str(e)}")
            return None

        return None


groq_service = GroqService()
