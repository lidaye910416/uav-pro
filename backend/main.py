from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes_auth import router as auth_router
from app.api.routes_alerts import router as alerts_router
# from app.api.routes_analyze import router as analyze_router
from app.api.routes_demo import router as demo_router
# from app.api.routes_streams import router as streams_router
from app.api.routes_admin import router as admin_router
from app.api.routes_ollama import router as ollama_router
from app.api.routes_uav import router as uav_router

from app.core.database import engine, Base

# Import all models so SQLAlchemy registers them with Base.metadata
from app.models.alert import Alert, RiskLevel, AlertStatus  # noqa: F401
from app.models.user import User                          # noqa: F401
from app.models.data_record import DataRecord            # noqa: F401
from app.models.device import Device                     # noqa: F401

# 后端启动入口 - 支持从环境变量读取端口
import os


def get_backend_port() -> int:
    """从环境变量获取后端端口，默认使用 settings.BACKEND_PORT"""
    env_port = os.getenv("BACKEND_PORT")
    if env_port:
        try:
            return int(env_port)
        except ValueError:
            pass
    return settings.BACKEND_PORT


if __name__ == "__main__":
    import uvicorn
    port = get_backend_port()
    print(f"[启动] 后端服务端口: {port}")
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)


@app.on_event("startup")
async def startup_event():
    """启动时创建所有表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
# app.include_router(analyze_router, prefix=settings.API_V1_STR)
app.include_router(demo_router, prefix=settings.API_V1_STR)
# app.include_router(streams_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(ollama_router, prefix=settings.API_V1_STR)
app.include_router(uav_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {"message": "UAV低空检测系统 API", "version": settings.VERSION}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
