from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "UAV低空检测系统"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # 数据库
    DATABASE_URL: str = "sqlite+aiosqlite:///./uav.db"

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24小时

    # CORS - 从环境变量读取，允许所有 localhost 端口
    BACKEND_CORS_ORIGINS: list[str] = []

    @property
    def cors_origins_dynamic(self) -> list[str]:
        """动态生成 CORS origins，基于环境变量中的前端端口配置"""
        origins = set(self.BACKEND_CORS_ORIGINS)
        # 添加默认端口
        default_ports = ["3000", "3001", "3002", "4000", "4001", "4002"]
        # 从环境变量添加自定义端口
        for port in default_ports:
            origins.add(f"http://localhost:{port}")
        # 添加任何以 localhost: 开头的端口
        import re
        extra = os.environ.get("EXTRA_CORS_ORIGINS", "")
        if extra:
            for o in extra.split(","):
                if o.strip():
                    origins.add(o.strip())
        return list(origins)

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # ChromaDB
    CHROMADB_PORT: int = 8001
    CHROMADB_URL: str = "http://localhost:8001"

    # Pipeline 运行模式: "single" | "dual"
    PIPELINE_MODE: str = "single"

    # ── 单模型模式（Gemma 4 E2B）───────────────
    MODEL_GEMMA4: str = "gemma4-e2b"

    # ── 双模型模式 ─────────────────────────────
    MODEL_VISION: str = "llava:7b"
    MODEL_DECISION: str = "deepseek-r1:1.5b"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
