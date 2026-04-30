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
