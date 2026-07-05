"""Anthropic-compatible 外部 LLM 客户端.

用于调用 MiniMax 等兼容 Anthropic Messages API 的外部 LLM 服务。
通过 httpx 异步调用，支持文本与多模态 (vision) 请求。
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class ExternalLLMError(RuntimeError):
    """外部 LLM 调用异常."""


class ExternalLLMClient:
    """Anthropic 兼容 API 异步客户端.

    支持:
      - chat_text: 纯文本对话
      - chat_vision: 图文多模态 (base64 图像)
      - test: 最小连通性测试
    """

    ANTHROPIC_VERSION = "2023-06-01"
    DEFAULT_TIMEOUT = 60.0

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": self.ANTHROPIC_VERSION,
            "content-type": "application/json",
        }

    def _extract_text(self, data: dict[str, Any]) -> str:
        """从 Anthropic 响应中提取首个 text block."""
        for block in data.get("content", []):
            if isinstance(block, dict) and block.get("type") == "text":
                return block.get("text", "")
        return ""

    async def chat_text(self, prompt: str, system: str = "") -> str:
        """纯文本对话.

        Args:
            prompt: 用户消息
            system: 系统提示词 (可选)

        Returns:
            助手回复文本
        """
        if not self.api_key:
            raise ExternalLLMError("EXTERNAL_LLM_API_KEY 未配置")

        payload: dict[str, Any] = {
            "model": self.model,
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            payload["system"] = system

        url = f"{self.base_url}/v1/messages"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(url, json=payload, headers=self._headers())
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPStatusError as e:
            detail = e.response.text[:300] if e.response is not None else str(e)
            logger.error("外部 LLM chat_text HTTP %s: %s", e.response.status_code, detail)
            raise ExternalLLMError(
                f"外部 LLM 返回 HTTP {e.response.status_code}: {detail}"
            ) from e
        except httpx.HTTPError as e:
            logger.error("外部 LLM chat_text 网络异常: %s", e)
            raise ExternalLLMError(f"外部 LLM 网络异常: {e}") from e

        text = self._extract_text(data)
        if not text:
            logger.warning("外部 LLM chat_text 返回空内容: %s", data)
        return text

    async def chat_vision(self, image_b64: str, prompt: str) -> str:
        """多模态对话 (base64 图像 + 文本).

        Args:
            image_b64: base64 编码的图像 (不含 data:image/... 前缀)
            prompt: 用户文本提示词

        Returns:
            助手回复文本
        """
        if not self.api_key:
            raise ExternalLLMError("EXTERNAL_LLM_API_KEY 未配置")

        payload: dict[str, Any] = {
            "model": self.model,
            "max_tokens": 1024,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        }

        url = f"{self.base_url}/v1/messages"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(url, json=payload, headers=self._headers())
                r.raise_for_status()
                data = r.json()
        except httpx.HTTPStatusError as e:
            detail = e.response.text[:300] if e.response is not None else str(e)
            logger.error("外部 LLM chat_vision HTTP %s: %s", e.response.status_code, detail)
            raise ExternalLLMError(
                f"外部 LLM 返回 HTTP {e.response.status_code}: {detail}"
            ) from e
        except httpx.HTTPError as e:
            logger.error("外部 LLM chat_vision 网络异常: %s", e)
            raise ExternalLLMError(f"外部 LLM 网络异常: {e}") from e

        text = self._extract_text(data)
        if not text:
            logger.warning("外部 LLM chat_vision 返回空内容: %s", data)
        return text

    async def test(self) -> dict[str, Any]:
        """最小连通性测试: 发送 1 token 文本请求.

        Returns:
            {"ok": bool, "message": str}
        """
        if not self.api_key:
            return {"ok": False, "message": "EXTERNAL_LLM_API_KEY 未配置"}

        try:
            text = await self.chat_text("hi", system="")
            return {"ok": True, "message": f"连通成功, 模型回复: {text[:80]!r}"}
        except ExternalLLMError as e:
            return {"ok": False, "message": str(e)}
        except Exception as e:  # noqa: BLE001
            logger.exception("外部 LLM test 未知异常")
            return {"ok": False, "message": f"未知异常: {e}"}