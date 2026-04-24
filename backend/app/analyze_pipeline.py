"""Analyze pipeline: chains vision → RAG → decision services."""
from __future__ import annotations

from pathlib import Path

from app.decision_service import AlertDecision, DecisionService
from app.rag_service import RAGService
from app.services.perception.frame_extractor import load_image
from app.vision_service import VisionService


class AnalyzePipeline:
    """Full analysis chain: image → vision description → RAG context → alert decision."""

    def __init__(
        self,
        vision_service: VisionService | None = None,
        rag_service: RAGService | None = None,
        decision_service: DecisionService | None = None,
    ) -> None:
        self.vision = vision_service or VisionService()
        self.rag = rag_service or RAGService()
        self.decision = decision_service or DecisionService()

    def run(self, image_path: str | Path) -> AlertDecision:
        """Run the full analysis pipeline on a single image.

        Args:
            image_path: Path to the image file (JPG/PNG/etc.).

        Returns:
            An AlertDecision with structured risk assessment.

        Raises:
            ValueError: if the image cannot be loaded.
        """
        path = str(image_path)
        img = load_image(path)
        if img is None:
            raise ValueError(f"无法加载图片: {path}")

        # 1. Vision — generate scene description
        scene_description = self.vision.describe_image(path)

        # 2. RAG — retrieve relevant SOP context
        context_docs = self.rag.retrieve(scene_description, top_k=3)

        # 3. Decision — produce structured alert
        return self.decision.decide(scene_description, context_docs)


def analyze_frame(image_path: str | Path) -> AlertDecision:
    """Convenience function: single image → alert decision."""
    return AnalyzePipeline().run(image_path)
