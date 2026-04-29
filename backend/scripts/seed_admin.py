"""创建默认管理员用户"""
import asyncio
import sys
sys.path.insert(0, str(__file__).rsplit("/scripts/", 1)[0])

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User

async def seed_admin():
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.username == "admin"))
        existing = result.scalar_one_or_none()
        
        if existing:
            print("✓ admin 用户已存在")
            return
        
        admin = User(
            username="admin",
            email="admin@uav-pro.local",
            hashed_password=get_password_hash("admin123"),
            full_name="系统管理员",
        )
        session.add(admin)
        await session.commit()
        print("✓ admin 用户创建成功 (密码: admin123)")

if __name__ == "__main__":
    asyncio.run(seed_admin())
