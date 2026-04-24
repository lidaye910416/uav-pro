from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.user import UserCreate, UserPublic
from app.schemas.token import Token
from app.services.auth_service import (
    authenticate_user,
    create_user,
    create_user_token,
    get_user_by_username,
    get_user_by_email,
)
from app.core.security import decode_token
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["认证"])

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(_oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    user = await get_user_by_username(db, username)
    if user is None:
        raise credentials_exception
    return user


@router.post("/register", response_model=UserPublic, status_code=201)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    if await get_user_by_username(db, user_data.username):
        raise HTTPException(status_code=400, detail="用户名已存在")
    if await get_user_by_email(db, user_data.email):
        raise HTTPException(status_code=400, detail="邮箱已被注册")
    user = await create_user(
        db, user_data.username, user_data.email, user_data.password, user_data.full_name
    )
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
):
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_user_token(user.username)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserPublic)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user
