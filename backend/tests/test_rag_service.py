import pytest
import shutil
from unittest.mock import MagicMock
from llama_index.core.base.embeddings.base import BaseEmbedding


def _fake_embedding():
    """Return a fake embedding model that returns 384-dim zero vectors."""
    class FakeEmbedding(BaseEmbedding):
        async def _aget_query_embedding(self, query): return [0.1] * 384
        def _get_query_embedding(self, query): return [0.1] * 384
        async def _aget_text_embedding(self, text): return [0.1] * 384
        def _get_text_embedding(self, text): return [0.1] * 384
        async def _aget_text_embeddings(self, texts): return [[0.1] * 384 for _ in texts]
        def _get_text_embeddings(self, texts): return [[0.1] * 384 for _ in texts]
    return FakeEmbedding()


from app.rag_service import RAGService


@pytest.fixture
def empty_kb(tmp_path):
    kb_dir = tmp_path / "empty_kb"
    kb_dir.mkdir()
    service = RAGService(
        persist_dir=str(kb_dir),
        embed_model=_fake_embedding(),
    )
    yield str(kb_dir)
    shutil.rmtree(kb_dir, ignore_errors=True)


@pytest.fixture
def populated_kb(tmp_path):
    kb_dir = tmp_path / "populated_kb"
    kb_dir.mkdir()
    service = RAGService(
        persist_dir=str(kb_dir),
        embed_model=_fake_embedding(),
    )
    service.add_document(
        "交通事故处理 SOP：当发现道路交通事故时，第一时间拨打 122 报警，"
        "并在来车方向设置警告标志，等待交警处理。切勿擅自移动现场。"
    )
    service.add_document(
        "无人机禁飞区管理 SOP：机场净空保护区、军事设施上方为永久禁飞区。"
        "遇突发情况需临时飞行，应提前向民航局申请飞行计划。"
    )
    yield str(kb_dir)
    shutil.rmtree(kb_dir, ignore_errors=True)


class TestRAGServiceInit:
    def test_instantiate_with_custom_dir(self, empty_kb):
        service = RAGService(
            persist_dir=empty_kb,
            embed_model=_fake_embedding(),
        )
        assert service.persist_dir == empty_kb

    def test_instantiate_creates_directory(self, tmp_path):
        kb_dir = tmp_path / "brand_new_kb"
        RAGService(
            persist_dir=str(kb_dir),
            embed_model=_fake_embedding(),
        )
        assert kb_dir.exists()


class TestRAGServiceRetrieve:
    def test_returns_list_of_strings(self, populated_kb):
        results = RAGService(
            persist_dir=populated_kb,
            embed_model=_fake_embedding(),
        ).retrieve("交通事故", top_k=3)
        assert isinstance(results, list)
        assert all(isinstance(r, str) for r in results)

    def test_returns_top_k_results_max(self, populated_kb):
        results = RAGService(
            persist_dir=populated_kb,
            embed_model=_fake_embedding(),
        ).retrieve("无人机", top_k=1)
        assert len(results) <= 1

    def test_returns_empty_for_empty_collection(self, empty_kb):
        results = RAGService(
            persist_dir=empty_kb,
            embed_model=_fake_embedding(),
        ).retrieve("任何查询", top_k=3)
        assert results == []


class TestRAGServiceAddDocument:
    def test_can_add_and_retrieve(self, tmp_path):
        kb_dir = tmp_path / "add_test_kb"
        kb_dir.mkdir()
        service = RAGService(
            persist_dir=str(kb_dir),
            embed_model=_fake_embedding(),
        )
        service.add_document("测试文档：禁飞区不得放飞无人机，违者依法处理。")
        results = service.retrieve("禁飞区", top_k=2)
        assert len(results) >= 1

    def test_multiple_documents_all_retrievable(self, tmp_path):
        kb_dir = tmp_path / "multi_doc_kb"
        kb_dir.mkdir()
        service = RAGService(
            persist_dir=str(kb_dir),
            embed_model=_fake_embedding(),
        )
        service.add_document("文档A：道路积水应绕行，禁止车辆通行。")
        service.add_document("文档B：无人机电池电量低于 20% 应立即返航。")
        r1 = service.retrieve("道路积水", top_k=2)
        r2 = service.retrieve("无人机电池", top_k=2)
        assert len(r1) >= 1
        assert len(r2) >= 1
