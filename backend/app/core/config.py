from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"  # Ignore extra env vars
    )

    PROJECT_NAME: str = "UAV低空检测系统"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # 数据库
    DATABASE_URL: str = "sqlite+aiosqlite:///./uav.db"

    # JWT
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24小时

    # 服务端口配置（从环境变量读取，动态构建 CORS origins）
    BACKEND_PORT: int = 8888
    SHOWCASE_PORT: int = 4000
    DASHBOARD_PORT: int = 4001
    ADMIN_PORT: int = 4002

    # CORS - 支持额外的自定义来源（可选）
    EXTRA_CORS_ORIGINS: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        """动态构建 CORS origins，基于服务端口配置"""
        origins = []

        # 后端端口
        origins.append(f"http://localhost:{self.BACKEND_PORT}")

        # 三个前端端口
        origins.append(f"http://localhost:{self.SHOWCASE_PORT}")
        origins.append(f"http://localhost:{self.DASHBOARD_PORT}")
        origins.append(f"http://localhost:{self.ADMIN_PORT}")

        # 额外端口（常见开发端口）
        common_dev_ports = [3000, 3001, 3002, 3003]
        for port in common_dev_ports:
            if port not in [self.BACKEND_PORT, self.SHOWCASE_PORT, self.DASHBOARD_PORT, self.ADMIN_PORT]:
                origins.append(f"http://localhost:{port}")

        # 从 EXTRA_CORS_ORIGINS 环境变量添加额外来源
        extra = os.environ.get("EXTRA_CORS_ORIGINS", self.EXTRA_CORS_ORIGINS)
        if extra:
            for o in extra.split(","):
                if o.strip():
                    origins.append(o.strip())

        return list(set(origins))

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # ChromaDB
    # 从环境变量读取，如果设置了 CHROMA_URL 则使用环境变量的值
    # 容器内：CHROMA_URL=http://chromadb:8000（Docker 网络）
    # 宿主机：CHROMADB_HOST=host.docker.internal, CHROMADB_PORT=9001
    CHROMADB_HOST: str = "host.docker.internal"  # 使用 Docker 主机地址
    CHROMADB_PORT: int = 9001  # 外部映射端口

    @property
    def CHROMADB_URL(self) -> str:
        """动态构建 ChromaDB URL"""
        # 优先使用环境变量 CHROMA_URL
        env_url = os.getenv("CHROMA_URL")
        if env_url:
            return env_url
        # 否则使用配置的 host 和 port
        return f"http://{self.CHROMADB_HOST}:{self.CHROMADB_PORT}"

    # Pipeline 运行模式: "single" | "dual"
    PIPELINE_MODE: str = "single"

    # ── 单模型模式（Gemma 4 E2B，如不可用则回退到 qwen2.5）───────────────
    MODEL_GEMMA4: str = "gemma4:e2b"

    # ── 双模型模式 ─────────────────────────────
    MODEL_VISION: str = "llava:7b"
    MODEL_DECISION: str = "deepseek-r1:1.5b"

    # ── LLM Provider ───────────────────────────────────────────────
    # "local" = Ollama (settings.MODEL_GEMMA4)
    # "external" = Anthropic 兼容 API (EXTERNAL_LLM_*)
    LLM_PROVIDER: str = "local"
    EXTERNAL_LLM_BASE_URL: str = "https://api.minimaxi.com/anthropic"
    EXTERNAL_LLM_API_KEY: str = ""
    EXTERNAL_LLM_MODEL: str = "MiniMax-M3"

    # ── Provider 目录 (用于管理端下拉选择) ──────────────────────────
    LLM_PROVIDERS_CATALOG: dict = {
        "ollama":    {"label":"本地 Ollama (gemma4)",   "default_base_url":"http://localhost:11434",            "protocol":"ollama",   "multimodal":True,  "models":["gemma4:e2b","llava:7b","qwen2.5-vl"]},
        "anthropic": {"label":"Anthropic 官方",          "default_base_url":"https://api.anthropic.com",         "protocol":"anthropic","multimodal":True,  "models":["claude-sonnet-4-5","claude-opus-4-8","claude-haiku-4-5"]},
        "minimax":   {"label":"MiniMax M3 (多模态)",     "default_base_url":"https://api.minimaxi.com/anthropic","protocol":"anthropic","multimodal":True,  "models":["MiniMax-M3","MiniMax-M2"]},
        "openai":    {"label":"OpenAI (GPT-4o)",         "default_base_url":"https://api.openai.com/v1",        "protocol":"openai",    "multimodal":True,  "models":["gpt-4o","gpt-4-turbo","o1","o3-mini"]},
        "deepseek":  {"label":"DeepSeek 官方",           "default_base_url":"https://api.deepseek.com/v1",      "protocol":"openai",    "multimodal":False, "models":["deepseek-chat","deepseek-reasoner"]},
        "custom":    {"label":"自定义 (Anthropic 兼容)", "default_base_url":"",                                  "protocol":"anthropic","multimodal":True,  "models":[]},
    }

    # ── Per-stage 覆盖 (None → 沿用 LLM_PROVIDER) ──────────────────
    VISION_PROVIDER:    Optional[str] = None
    VISION_MODEL:       Optional[str] = None
    DECISION_PROVIDER:  Optional[str] = None
    DECISION_MODEL:     Optional[str] = None


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def resolve_provider_id(explicit: str | None) -> str:
    """将历史 provider 别名映射到目录 id.

    - "local"    -> "ollama"
    - "external" -> "anthropic"   (保留向后兼容)
    - 其他       -> 原值
    """
    if not explicit:
        return "ollama"
    mapping = {"local": "ollama", "external": "anthropic"}
    return mapping.get(explicit, explicit)


settings = get_settings()
