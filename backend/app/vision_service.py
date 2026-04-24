"""Vision service: sends images to Ollama vision model for multimodal understanding."""
from __future__ import annotations

import base64
import json
from io import BytesIO
from typing import Any

import httpx
from PIL import Image

from config import llm_config

DEFAULT_VISION_PROMPT = (
    "你是一个高速公路安全监控专家。请详细描述这张航拍图像："
    "1. 场景类型（高速公路/停车场/普通道路）"
    "2. 可见的车辆、行人、障碍物或其他物体"
    "3. 任何异常情况，如：违规停车、道路遗撒、交通事故、行人闯入等"
    "请用中文回答，描述尽量详细，包括物体的大致位置。"
)


class LLMServiceUnavailableError(Exception):
    """Raised when Ollama service is unreachable or returns an error."""
    pass


class VisionService:
    def __init__(
        self,
        ollama_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = ollama_url or llm_config["ollama"]["base_url"]
        self.model = model or llm_config["model"]["vision"]
        self.timeout = timeout or float(llm_config["ollama"].get("timeout_sec", 60))

    def _image_to_base64(self, image: Image.Image) -> str:
        """Convert PIL Image to a JPEG base64 string."""
        if image.mode != "RGB":
            image = image.convert("RGB")
        buf = BytesIO()
        image.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    def describe_image(
        self,
        image_path: str,
        prompt: str = DEFAULT_VISION_PROMPT,
    ) -> str:
        """Send an image to Ollama vision model via /api/chat and return the description.

        Args:
            image_path: Path to the image file (JPG/PNG/etc.).
            prompt: Instruction prompt sent to the model.

        Returns:
            The model's text description (stripped).

        Raises:
            LLMServiceUnavailableError: if Ollama cannot be reached or responds
                with a non-success HTTP status.
        """
        img = Image.open(image_path)
        img_b64 = self._image_to_base64(img)

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                    "images": [img_b64],
                }
            ],
            "stream": False,
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
                result = response.json()
                # Ollama /api/chat returns { "message": { "content": "..." } }
                return result.get("message", {}).get("content", "").strip()
        except (
            httpx.ConnectError,
            httpx.TimeoutException,
            httpx.HTTPStatusError,
            httpx.RequestError,
        ) as exc:
            raise LLMServiceUnavailableError(
                f"Ollama service unavailable at {self.base_url}"
            ) from exc
