from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes_auth import router as auth_router
from app.api.routes_alerts import router as alerts_router
from app.api.routes_analyze import router as analyze_router
from app.api.routes_demo import router as demo_router
from app.api.routes_streams import router as streams_router
from app.api.routes_admin import router as admin_router
from app.api.routes_ollama import router as ollama_router
from app.api.routes_uav import router as uav_router

# Import all models so SQLAlchemy registers them with Base.metadata
from app.models.alert import Alert, RiskLevel, AlertStatus  # noqa: F401
from app.models.user import User                          # noqa: F401
from app.models.data_record import DataRecord            # noqa: F401
from app.models.device import Device                     # noqa: F401

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_dynamic,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
