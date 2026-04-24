from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.core.database import get_db
from app.schemas.alert import AlertCreate, AlertUpdate, AlertInDB, AlertListResponse
from app.services.alert_service import (
    create_alert,
    get_alerts,
    get_alert_by_id,
    update_alert,
    delete_alert,
    get_alert_stats,
)
from app.models.alert import RiskLevel, AlertStatus
from app.models.user import User
from app.api.routes_auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["预警"])


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    risk_level: Optional[RiskLevel] = None,
    status: Optional[AlertStatus] = None,
    db: AsyncSession = Depends(get_db),
):
    total, items = await get_alerts(db, skip, limit, risk_level, status)
    return {"total": total, "items": items}


@router.get("/stats", response_model=dict)
async def alert_stats(db: AsyncSession = Depends(get_db)):
    return await get_alert_stats(db)


@router.get("/{alert_id}", response_model=AlertInDB)
async def get_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    alert = await get_alert_by_id(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="预警不存在")
    return alert


@router.post("", response_model=AlertInDB, status_code=201)
async def create_new_alert(
    alert_data: AlertCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    alert = await create_alert(db, alert_data.model_dump(), user_id=current_user.id)
    return alert


@router.put("/{alert_id}", response_model=AlertInDB)
async def update_existing_alert(
    alert_id: int,
    update_data: AlertUpdate,
    db: AsyncSession = Depends(get_db),
):
    alert = await update_alert(db, alert_id, update_data.model_dump(exclude_unset=True))
    if not alert:
        raise HTTPException(status_code=404, detail="预警不存在")
    return alert


@router.delete("/{alert_id}", status_code=204)
async def delete_existing_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = await delete_alert(db, alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="预警不存在")
