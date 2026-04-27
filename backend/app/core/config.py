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
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:4000,http://localhost:4001,http://localhost:4002,http://localhost:9000"

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

        # 添加默认端口
        default_ports = ["3000", "3001", "3002", "4000", "4001", "4002"]
        for port in default_ports:
            origins.append(f"http://localhost:{port}")
        # 添加任何以 localhost: 开头的端口
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

    # ── 单模型模式（Gemma 4 E2B）───────────────
    MODEL_GEMMA4: str = "gemma4-e2b"

    # ── 双模型模式 ─────────────────────────────
    MODEL_VISION: str = "llava:7b"
    MODEL_DECISION: str = "deepseek-r1:1.5b"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
