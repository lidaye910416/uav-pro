from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import engine, Base
from app.services.health_monitor import start_monitor, stop_monitor

# Import all models so SQLAlchemy registers them with Base.metadata
from app.models.alert import Alert, RiskLevel, AlertStatus  # noqa: F401
from app.models.user import User                          # noqa: F401
from app.models.data_record import DataRecord            # noqa: F401
from app.models.device import Device                     # noqa: F401

logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """生命周期管理：启动时创建表 + 启动健康监控，关闭时停止监控"""
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # 启动后台健康监控（独立日志，每30秒检查一次）
    await start_monitor()
    logger.info("UAV-PRO 后端已启动，健康监控运行中")
    yield
    # Shutdown
    from app.services.health_monitor import stop_monitor
    await stop_monitor()
    logger.info("UAV-PRO 后端已关闭")


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

from app.api.routes_auth import router as auth_router
from app.api.routes_alerts import router as alerts_router
from app.api.routes_analyze import router as analyze_router
from app.api.routes_demo import router as demo_router
from app.api.routes_streams import router as streams_router
from app.api.routes_admin import router as admin_router
from app.api.routes_ollama import router as ollama_router
from app.api.routes_uav import router as uav_router

app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
app.include_router(analyze_router, prefix=settings.API_V1_STR)
app.include_router(demo_router, prefix=settings.API_V1_STR)
app.include_router(streams_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(ollama_router, prefix=settings.API_V1_STR)
app.include_router(uav_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {"message": "UAV低空检测系统 API", "version": settings.VERSION}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/health/services")
async def services_health():
    """返回所有依赖服务的实时健康状态（由 HealthMonitor 后台任务维护）"""
    from app.services.health_monitor import get_monitor
    monitor = get_monitor()
    return {
        "monitor_interval_sec": monitor.check_interval,
        "services": monitor.get_status(),
    }
