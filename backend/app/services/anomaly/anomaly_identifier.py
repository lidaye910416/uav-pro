"""异常识别模块 - 支持 Gemma4:e2b 多模态"""
from __future__ import annotations

import base64
import json
import os
import re
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any, List

import httpx
import yaml
import cv2
import numpy as np
from PIL import Image

from config import llm_config


@dataclass
class AnomalyResult:
    """异常识别结果

    Attributes:
        has_incident: 是否有异常
        incident_type: 异常类型 (collision/pothole/obstacle/parking/pedestrian/congestion/none)
        confidence: 置信度 (0.0-1.0)
        description: 异常描述
        visual_evidence: 可视化证据列表
        reason: 识别原因
        recommendation: 处置建议 (由 Gemma 生成)
    """
    has_incident: bool
    incident_type: str = "none"
    confidence: float = 0.0
    description: str = ""
    visual_evidence: List[str] = field(default_factory=list)
    reason: str = ""
    recommendation: str = ""


class LLMServiceUnavailableError(Exception):
    """Raised when Ollama service is unreachable."""
    pass


class AnomalyIdentifier:
    """使用多模态 LLM 进行道路异常识别"""
    
    INCIDENT_TYPES = [
        "collision", "pothole", "obstacle", "parking", "pedestrian", "congestion"
    ]
    
    def __init__(
        self,
        ollama_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ) -> None:
        self.base_url = ollama_url or llm_config["ollama"]["base_url"]
        self.timeout = timeout or 180
        self.model = model or llm_config["model"].get("gemma4_e2b", "gemma4:e2b")
    
    def _image_to_base64(self, frame) -> str:
        """Convert numpy array to JPEG base64 string."""
        img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode("utf-8")
    
    def identify_from_array(
        self,
        frame,
        roi_description: str = "",
        motion_info: dict | None = None,
    ) -> AnomalyResult:
        """从帧识别异常"""
        img_b64 = self._image_to_base64(frame)
        
        # 构建提示
        motion_str = json.dumps(motion_info, ensure_ascii=False) if motion_info else "无"
        
        prompt = f"""分析这张航拍图像，判断是否存在以下6类道路异常之一：

异常类型：
1. collision - 交通事故/碰撞（车辆聚集、变形、散落物）
2. pothole - 路面塌陷/坑洞（路面凹陷、颜色变暗）
3. obstacle - 道路障碍物（落石、遗撒物）
4. parking - 异常停车（应急车道停车）
5. pedestrian - 行人闯入（人形出现在非正常区域）
6. congestion - 交通拥堵（车辆密集、排队）

场景描述：{roi_description or '航拍道路'}
运动信息：{motion_str}

请按JSON格式输出：
{{"has_incident": true/false, "incident_type": "类型或none", "confidence": 0.0-1.0, "description": "描述", "visual_evidence": ["证据1", "证据2"]}}"""

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt, "images": [img_b64]}],
            "stream": False,
        }
        
        try:
            # 确保 localhost 不走代理
            os_no_proxy = os.environ.get("no_proxy", "") + ",localhost,127.0.0.1"
            os.environ["no_proxy"] = os_no_proxy
            os.environ["NO_PROXY"] = os_no_proxy

            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
                raw = response.json().get("message", {}).get("content", "").strip()
        except httpx.ProxyError:
            # 代理错误时，尝试直接连接
            with httpx.Client(
                timeout=self.timeout,
                proxy=None,
            ) as client:
                response = client.post(f"{self.base_url}/api/chat", json=payload)
                response.raise_for_status()
                raw = response.json().get("message", {}).get("content", "").strip()
        except Exception as exc:
            raise LLMServiceUnavailableError(f"Ollama error: {exc}") from exc
        
        return self._parse_response(raw)
    
    def _parse_response(self, raw: str) -> AnomalyResult:
        """解析 LLM 输出"""
        # 尝试提取 JSON
        try:
            # 清理 markdown 代码块
            if "```json" in raw:
                raw = re.search(r"```json\s*(.*?)\s*```", raw, re.DOTALL).group(1)
            elif "```" in raw:
                raw = re.search(r"```\s*(.*?)\s*```", raw, re.DOTALL).group(1)

            # 查找 JSON 对象（支持嵌套）
            json_match = re.search(r"\{[\s\S]*\}", raw)
            if json_match:
                data = json.loads(json_match.group())

                # 标准化 incident_type
                incident_type = data.get("incident_type", "none")
                # 处理各种"无异常"的表述
                if incident_type in ["none", "无", "无异常", "无安全事件", "无事件", "正常", "安全"]:
                    incident_type = "none"
                    has_incident = False
                else:
                    has_incident = data.get("has_incident", False)

                return AnomalyResult(
                    has_incident=has_incident,
                    incident_type=incident_type,
                    confidence=float(data.get("confidence", 0.0)),
                    description=data.get("description", ""),
                    visual_evidence=data.get("visual_evidence", []),
                    recommendation=data.get("recommendation", ""),
                    reason="JSON解析",
                )
        except (json.JSONDecodeError, ValueError, AttributeError):
            pass

        # 尝试文本匹配
        raw_lower = raw.lower()
        for it in self.INCIDENT_TYPES:
            if it in raw_lower and ("是" in raw or "存在" in raw or "检测" in raw):
                return AnomalyResult(
                    has_incident=True, incident_type=it, confidence=0.5,
                    description=raw[:100], visual_evidence=[],
                    recommendation="请按照标准流程处置", reason="文本匹配"
                )

        return AnomalyResult(
            has_incident=False, incident_type="none", confidence=0.0,
            description="未检测到异常", recommendation=""
        )


# 测试
if __name__ == "__main__":
    import sys
    identifier = AnomalyIdentifier()
    print(f"模型: {identifier.model}")
