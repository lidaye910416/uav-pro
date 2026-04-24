"""RAG knowledge base service: ChromaDB + LlamaIndex for SOP retrieval."""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import chromadb
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.core.base.embeddings.base import BaseEmbedding
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.vector_stores.chroma import ChromaVectorStore

from config import pipeline_config

if TYPE_CHECKING:
    from llama_index.core.llms import LLM


def _default_embed_model() -> BaseEmbedding:
    """Build an OllamaEmbedding for nomic-embed-text (lazy import)."""
    from llama_index.embeddings.ollama import OllamaEmbedding
    from config import llm_config

    return OllamaEmbedding(
        model_name="nomic-embed-text",
        base_url=llm_config["ollama"]["base_url"],
    )


class RAGService:
    """Semantic SOP retrieval backed by ChromaDB + Ollama embeddings."""

    def __init__(
        self,
        persist_dir: str | None = None,
        top_k: int = 3,
        collection_name: str = "uav_sops",
        embed_model: BaseEmbedding | None = None,
        llm: "LLM | None" = None,
    ) -> None:
        self.persist_dir = persist_dir or pipeline_config["rag"]["persist_dir"]
        self.top_k = top_k
        self.collection_name = collection_name
        self._embed_model: BaseEmbedding = embed_model or _default_embed_model()
        self._llm: "LLM | None" = llm  # kept for future LLM-augmented retrieval
        self._index: VectorStoreIndex | None = None
        self._setup()

    def _setup(self) -> None:
        """Initialise ChromaDB client (Persistent or HTTP) and LlamaIndex vector index."""
        import os as _os

        if _os.environ.get("CHROMA_URL"):
            # Docker: connect to chromadb service via HTTP
            from urllib.parse import urlparse as _urlparse
            _url = _os.environ["CHROMA_URL"]
            _parsed = _urlparse(_url)
            _host = _parsed.hostname or "localhost"
            _port = _parsed.port or 8000
            _chroma_client = chromadb.HttpClient(host=_host, port=_port)
        else:
            # Local dev: use PersistentClient on filesystem
            _persist_path = Path(self.persist_dir)
            _persist_path.mkdir(parents=True, exist_ok=True)
            _chroma_client = chromadb.PersistentClient(path=str(_persist_path))

        chroma_collection = _chroma_client.get_or_create_collection(
            name=self.collection_name,
        )

        vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)

        self._index = VectorStoreIndex.from_vector_store(
            vector_store,
            storage_context=storage_context,
            embed_model=self._embed_model,
        )

    def retrieve(self, query: str, top_k: int | None = None) -> list[str]:
        """Semantic search over indexed SOP documents.

        Args:
            query: Natural-language query string.
            top_k: Maximum number of results to return.

        Returns:
            A list of text chunks, sorted by relevance descending.
            Returns an empty list if the index is empty or unavailable.
        """
        if self._index is None:
            return []

        k = top_k if top_k is not None else self.top_k
        retriever = VectorIndexRetriever(index=self._index, similarity_top_k=k)
        nodes = retriever.retrieve(query)
        return [str(node.text) for node in nodes]

    def add_document(self, text: str, metadata: dict | None = None) -> None:
        """Index a single text document into ChromaDB.

        Args:
            text: Document content to embed and store.
            metadata: Optional metadata dict attached to the chunk.
        """
        if self._index is None:
            self._setup()

        from llama_index.core.schema import TextNode

        node = TextNode(text=text, metadata=metadata or {})
        self._index.insert_nodes([node])
        self._index.storage_context.persist(persist_dir=self.persist_dir)
