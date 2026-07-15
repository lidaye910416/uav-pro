"""UAV 低空检测智能安全预警系统 - FastAPI 入口."""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_admin import router as admin_router
from app.api.routes_alerts import router as alerts_router
from app.api.routes_auth import router as auth_router
from app.api.routes_demo import router as demo_router
from app.api.routes_llm import router as llm_router
from app.api.routes_llm import public_router as llm_public_router
from app.api.routes_ollama import router as ollama_router
from app.api.routes_uav import router as uav_router
from app.core.config import settings
from app.core.database import Base, engine

# 触发 SQLAlchemy 模型注册
from app.models.alert import Alert, AlertStatus, RiskLevel  # noqa: F401
from app.models.data_record import DataRecord  # noqa: F401
from app.models.user import User  # noqa: F401

logger = logging.getLogger(__name__)


def _get_backend_port() -> int:
    """从环境变量获取后端端口，缺省使用 settings.BACKEND_PORT."""
    env_port = os.getenv("BACKEND_PORT")
    if env_port:
        try:
            return int(env_port)
        except ValueError:
            pass
    return settings.BACKEND_PORT


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """启动时创建所有表，关闭时释放引擎."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("数据库表已就绪")
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
app.include_router(demo_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(ollama_router, prefix=settings.API_V1_STR)
app.include_router(uav_router, prefix=settings.API_V1_STR)
app.include_router(llm_router, prefix=settings.API_V1_STR)
app.include_router(llm_public_router, prefix=settings.API_V1_STR)


@app.get("/")
def root() -> dict:
    return {"message": "UAV低空检测系统 API", "version": settings.VERSION}


@app.get("/health")
def health_check() -> dict:
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    port = _get_backend_port()
    logger.info("后端服务端口: %s", port)
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
