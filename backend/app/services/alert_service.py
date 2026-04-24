from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.models.alert import Alert, RiskLevel, AlertStatus
from typing import Optional


async def create_alert(db: AsyncSession, alert_data: dict, user_id: int) -> Alert:
    alert = Alert(**alert_data, created_by=user_id)
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


async def get_alerts(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    risk_level: Optional[RiskLevel] = None,
    status: Optional[AlertStatus] = None,
) -> tuple[int, list[Alert]]:
    query = select(Alert)
    count_query = select(func.count(Alert.id))

    if risk_level:
        query = query.where(Alert.risk_level == risk_level)
        count_query = count_query.where(Alert.risk_level == risk_level)
    if status:
        query = query.where(Alert.status == status)
        count_query = count_query.where(Alert.status == status)

    query = query.order_by(desc(Alert.created_at)).offset(skip).limit(limit)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    result = await db.execute(query)
    items = result.scalars().all()

    return total, list(items)


async def get_alert_by_id(db: AsyncSession, alert_id: int) -> Optional[Alert]:
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    return result.scalar_one_or_none()


async def update_alert(db: AsyncSession, alert_id: int, update_data: dict) -> Optional[Alert]:
    alert = await get_alert_by_id(db, alert_id)
    if not alert:
        return None
    for key, value in update_data.items():
        if value is not None:
            setattr(alert, key, value)
    await db.commit()
    await db.refresh(alert)
    return alert


async def delete_alert(db: AsyncSession, alert_id: int) -> bool:
    alert = await get_alert_by_id(db, alert_id)
    if not alert:
        return False
    await db.delete(alert)
    await db.commit()
    return True


async def get_alert_stats(db: AsyncSession) -> dict:
    result = await db.execute(select(func.count(Alert.id)))
    total = result.scalar()

    stats = {"total": total}

    for level in RiskLevel:
        r = await db.execute(select(func.count(Alert.id)).where(Alert.risk_level == level))
        stats[f"risk_{level.value}"] = r.scalar()

    for status_val in AlertStatus:
        r = await db.execute(select(func.count(Alert.id)).where(Alert.status == status_val))
        stats[f"status_{status_val.value}"] = r.scalar()

    return stats
