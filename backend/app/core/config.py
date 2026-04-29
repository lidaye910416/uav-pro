from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
import os


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
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24小时

    # CORS - 从环境变量读取，可以是逗号分隔的字符串或 JSON 数组
    # 默认端口: 8888(后端), 4000(showcase), 4001(dashboard), 4002(admin)
    BACKEND_CORS_ORIGINS: str = "http://localhost:8888,http://localhost:4000,http://localhost:4001,http://localhost:4002"

    @property
    def cors_origins_list(self) -> list[str]:
        """解析 CORS origins，可以是逗号分隔的字符串或 JSON 数组"""
        if not self.BACKEND_CORS_ORIGINS:
            origins = []
        elif self.BACKEND_CORS_ORIGINS.startswith("[") or self.BACKEND_CORS_ORIGINS.startswith("'"):
            # JSON 数组格式
            try:
                import json
                origins = json.loads(self.BACKEND_CORS_ORIGINS)
            except:
                origins = [o.strip() for o in self.BACKEND_CORS_ORIGINS.strip("[]'\"").split(",") if o.strip()]
        else:
            # 逗号分隔的字符串
            origins = [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]

        # 添加默认端口（后端 + 三个前端）
        default_ports = ["8888", "4000", "4001", "4002"]
        for port in default_ports:
            origins.append(f"http://localhost:{port}")

        # 添加 EXTRA_CORS_ORIGINS 中的额外来源
        extra = os.environ.get("EXTRA_CORS_ORIGINS", "")
        if extra:
            for o in extra.split(","):
                if o.strip():
                    origins.append(o.strip())
        return list(set(origins))

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # ChromaDB
    CHROMADB_PORT: int = 8001
    CHROMADB_URL: str = "http://localhost:8001"

    # Pipeline 运行模式: "single" | "dual"
    PIPELINE_MODE: str = "single"

    # ── 单模型模式（Gemma 4 E2B，如不可用则回退到 qwen2.5）───────────────
    MODEL_GEMMA4: str = "gemma4:e2b"

    # ── 双模型模式 ─────────────────────────────
    MODEL_VISION: str = "llava:7b"
    MODEL_DECISION: str = "deepseek-r1:1.5b"

    # ── 模型自动检测 ─────────────────────────────
    # 这些会在运行时自动检测可用的模型
    _available_gemma: str | None = None
    _available_qwen: str | None = None

    def get_vision_model(self) -> str:
        """获取可用的视觉模型"""
        # 优先使用 Gemma4
        if self._available_gemma:
            return self._available_gemma
        # 回退到 Qwen
        if self._available_qwen:
            return self._available_qwen
        return "qwen2.5:latest"

    def get_embed_model(self) -> str:
        """获取可用的嵌入模型"""
        return "nomic-embed-text"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
