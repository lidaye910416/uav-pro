# backend/app/services/vision_service.py
"""Vision service: sends images to Ollama vision model for multimodal understanding."""
from __future__ import annotations

import base64
import json
from io import BytesIO
from typing import Any

import cv2
import httpx
import numpy as np
from PIL import Image

try:
    from config import llm_config
except ImportError:
    # Fallback if config is not available
    llm_config = {
        "ollama": {
            "base_url": "http://localhost:11434",
            "timeout_sec": 60
        },
        "model": {
            "vision": "llava:7b"
        }
    }

from app.services.types import VisionResult


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

    async def analyze(
        self,
        frame_bgr: np.ndarray,
        yolo_detections: list[dict] | None = None,
        timeout: float = 300.0,
    ) -> VisionResult:
        """纯视觉分析，不使用 RAG
        
        Args:
            frame_bgr: BGR 格式的图像
            yolo_detections: YOLO 检测结果
            timeout: 超时时间（秒）
            
        Returns:
            VisionResult: 包含 has_event, incident_type, severity, confidence, scene_description, description
        """
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(frame_rgb)
        img_b64 = self._image_to_base64(pil_img)
        
        # 构建 YOLO 检测结果摘要
        yolo_summary = ""
        if yolo_detections:
            categories = {}
            for det in yolo_detections:
                label = det.get('label', 'unknown')
                categories[label] = categories.get(label, 0) + 1
            if categories:
                parts = [f"{label} {count}个" for label, count in sorted(categories.items())]
                yolo_summary = f"【图像中的物体】检测到：{', '.join(parts)}。"
        
        system_prompt = f"""你是高速公路航拍图像安全分析专家。

【任务】
仅根据图像中的静态视觉特征，独立判断是否存在以下事件之一：

  collision  - 车辆碰撞/追尾
  pothole    - 道路坑洼
  obstacle   - 障碍物/遗撒
  pedestrian - 行人异常
  congestion - 交通拥堵
  none       - 无异常

{yolo_summary}

【判断原则】
1. 仅基于当前帧的视觉特征
2. 置信度较低时，倾向于判断为 "none"
3. 不要参考任何外部规范

【输出格式 - 严格JSON】
{{
  "has_event": true或false,
  "incident_type": "collision/pothole/obstacle/pedestrian/congestion/none",
  "severity": "high/mid/low/none",
  "confidence": 0-100,
  "scene_description": "场景描述（40字内）",
  "description": "具体观察到的视觉特征（60字内）"
}}

只输出 JSON，不要其他任何文字。"""

        user_prompt = """请分析这张航拍图像，独立判断是否存在交通安全异常。

观察要点：
1. 整体场景（直道/弯道/立交/收费站）
2. 车辆状态（正常行驶/停滞/异常聚集）
3. 路面状况（坑洞/遗撒/积水/破损）
4. 行人/非机动车（是否在禁止区域）
5. 异常物体（障碍物/事故车辆/散落物）

请仅基于图像中的实际视觉特征给出判断。"""

        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        payload = {
            "model": self.model,
            "prompt": full_prompt,
            "images": [img_b64],
            "stream": False,
            "think": False,
            "options": {"num_predict": 200},
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                print(f"[VisionService] 调用 Ollama，timeout={timeout}s")
                r = await client.post(f"{self.base_url}/api/generate", json=payload)
                r.raise_for_status()
                raw = r.json().get("response", "").strip()
                print(f"[VisionService] 原始响应: {raw[:150]}...")

            # 解析 JSON
            clean_raw = raw.replace('```json', '').replace('```', '').strip()
            start = clean_raw.find("{")
            end = clean_raw.rfind("}") + 1

            if start != -1 and end > start:
                json_str = clean_raw[start:end]
                result = json.loads(json_str)
                return VisionResult(
                    has_event=bool(result.get("has_event", False)),
                    incident_type=result.get("incident_type", "none"),
                    severity=str(result.get("severity", "low")).lower(),
                    confidence=round(max(0.0, min(1.0, float(result.get("confidence", 0.5)))), 2),
                    scene_description=result.get("scene_description", ""),
                    description=result.get("description", ""),
                )

            return VisionResult(
                has_event=False,
                incident_type="none",
                severity="none",
                confidence=0.5,
                scene_description="分析失败，回退为正常",
                description=raw[:100] if raw else "分析失败",
            )
        except Exception as e:
            print(f"[VisionService] 分析失败: {e}")
            return VisionResult(
                has_event=False,
                incident_type="none",
                severity="none",
                confidence=0.5,
                scene_description="分析服务不可用",
                description="AI分析失败",
            )
