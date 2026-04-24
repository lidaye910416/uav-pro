"""Decision service: Gemma 4 E2B function calling for risk assessment."""
from __future__ import annotations

import json
import re
from typing import Annotated

import httpx
from pydantic import BaseModel, Field

from config import llm_config


class AlertDecision(BaseModel):
    """Structured alert decision returned by the LLM."""

    should_alert: bool
    risk_level: Annotated[str, Field(pattern=r"^(low|medium|high|critical)$")]
    title: str
    description: str
    recommendation: str
    confidence: Annotated[float, Field(ge=0.0, le=1.0)]


SYSTEM_PROMPT = (
    "你是一个高速公路安全预警专家。"
    "根据场景描述和处置规范，判断是否需要预警。"
    "严格按以下 JSON 格式输出，不要添加任何解释："
)

USER_PROMPT_TEMPLATE = """场景描述：
{scene_description}

相关处置规范：
{context_docs}

请以 JSON 格式输出决策：
{{
  "should_alert": true或false,
  "risk_level": "low"或"medium"或"high"或"critical",
  "title": "预警标题（10字内）",
  "description": "预警描述（30字内）",
  "recommendation": "处置建议（40字内）",
  "confidence": 0.0到1.0之间的数字
}}"""


class DecisionService:
    """Calls Ollama Gemma 4 E2B with a structured prompt to produce AlertDecision."""

    def __init__(
        self,
        ollama_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = ollama_url or llm_config["ollama"]["base_url"]
        self.model = model or llm_config["model"]["decision"]
        self.timeout = timeout or float(llm_config["ollama"].get("timeout_sec", 30))

    def decide(
        self,
        scene_description: str,
        context_docs: list[str],
    ) -> AlertDecision:
        """Evaluate a scene description against SOP context and return an alert decision.

        Args:
            scene_description: Natural-language description of the observed scene.
            context_docs: Relevant SOP chunks retrieved from the knowledge base.

        Returns:
            An AlertDecision with structured risk assessment fields.

        Raises:
            LLMServiceUnavailableError: if Ollama is unreachable.
        """
        from app.vision_service import LLMServiceUnavailableError

        context_text = (
            "\n".join(f"- {doc}" for doc in context_docs)
            if context_docs
            else "（无相关规范）"
        )
        user_prompt = USER_PROMPT_TEMPLATE.format(
            scene_description=scene_description,
            context_docs=context_text,
        )

        payload = {
            "model": self.model,
            "prompt": user_prompt,
            "system": SYSTEM_PROMPT,
            "stream": False,
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(f"{self.base_url}/api/generate", json=payload)
                response.raise_for_status()
                raw = response.json().get("response", "").strip()
        except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as exc:
            raise LLMServiceUnavailableError(
                f"Ollama service unavailable at {self.base_url}"
            ) from exc

        # Try to extract and parse JSON from the response
        try:
            json_match = re.search(r"\{[^{}]*\}", raw, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
            else:
                data = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            # Fallback when JSON parsing fails
            data = {
                "should_alert": True,
                "risk_level": "medium",
                "title": "AI决策解析失败",
                "description": raw[:100] if raw else "无法解析LLM输出",
                "recommendation": "请人工确认",
                "confidence": 0.0,
            }

        return AlertDecision(**data)
