#!/bin/bash
# UAV-PRO 服务管理脚本
# 设置颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# 检查并创建数据库表
init_database() {
    echo -e "${YELLOW}检查数据库...${NC}"
    cd "$PROJECT_ROOT/backend"
    python3 -c "
from sqlalchemy import create_engine, text
import os

db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'uav.db')
engine = create_engine(f'sqlite:///{db_path}')

with engine.connect() as conn:
    # 检查 alerts 表
    try:
        conn.execute(text('SELECT 1 FROM alerts LIMIT 1'))
        print('✓ alerts 表存在')
    except:
        print('⚠ alerts 表不存在，创建中...')
        conn.execute(text('''
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                risk_level TEXT,
                recommendation TEXT,
                confidence REAL,
                scene_description TEXT,
                source_type TEXT,
                source_path TEXT,
                pipeline_mode TEXT,
                ai_model TEXT,
                detection_details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        '''))
        conn.commit()
        print('✓ alerts 表创建完成')
except Exception as e:
    print(f'数据库检查失败: {e}')
"
    cd "$PROJECT_ROOT"
}

# 停止所有服务
stop_all() {
    echo -e "${YELLOW}停止所有服务...${NC}"
    pkill -f "uvicorn main:app" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}✓ 所有服务已停止${NC}"
}

# 启动后端
start_backend() {
    echo -e "${YELLOW}启动后端 (端口 8000)...${NC}"
    cd "$PROJECT_ROOT/backend"
    nohup env PYTHONPATH="$PROJECT_ROOT/backend" python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 > /tmp/backend.log 2>&1 &
    sleep 3
    if curl -s http://localhost:8000/docs > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端已启动${NC}"
    else
        echo -e "${RED}✗ 后端启动失败${NC}"
        tail -20 /tmp/backend.log
    fi
}

# 启动前端 Showcase
start_showcase() {
    echo -e "${YELLOW}启动前端 Showcase (端口 3000)...${NC}"
    cd "$PROJECT_ROOT/frontend/apps/showcase"
    nohup npm run dev > /tmp/showcase.log 2>&1 &
    sleep 8
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Showcase 已启动${NC}"
    else
        echo -e "${RED}✗ Showcase 启动失败${NC}"
        tail -10 /tmp/showcase.log
    fi
}

# 启动前端 Dashboard
start_dashboard() {
    echo -e "${YELLOW}启动前端 Dashboard (端口 3001)...${NC}"
    cd "$PROJECT_ROOT/frontend/apps/dashboard"
    nohup npm run dev -- -p 3001 > /tmp/dashboard.log 2>&1 &
    sleep 6
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Dashboard 已启动${NC}"
    else
        echo -e "${RED}✗ Dashboard 启动失败${NC}"
    fi
}

# 启动前端 Admin
start_admin() {
    echo -e "${YELLOW}启动前端 Admin (端口 3002)...${NC}"
    cd "$PROJECT_ROOT/frontend/apps/admin"
    nohup npm run dev -- -p 3002 > /tmp/admin.log 2>&1 &
    sleep 6
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Admin 已启动${NC}"
    else
        echo -e "${RED}✗ Admin 启动失败${NC}"
    fi
}

# 检查服务状态
check_status() {
    echo ""
    echo "=========================================="
    echo -e "              服务状态检查"
    echo "=========================================="
    
    check_service "后端 API" "http://localhost:8000/docs"
    check_service "首页 Showcase" "http://localhost:3000"
    check_service "感知中心 Dashboard" "http://localhost:3001"
    check_service "管理后台 Admin" "http://localhost:3002"
    
    echo "=========================================="
}

check_service() {
    local name=$1
    local url=$2
    if curl -s --max-time 3 "$url" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $name"
    else
        echo -e "  ${RED}✗${NC} $name (离线)"
    fi
}

# 主流程
case "${1:-start}" in
    start)
        init_database
        stop_all
        start_backend
        start_showcase
        start_dashboard
        start_admin
        sleep 2
        check_status
        ;;
    stop)
        stop_all
        ;;
    restart)
        init_database
        stop_all
        start_backend
        start_showcase
        start_dashboard
        start_admin
        check_status
        ;;
    status)
        check_status
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
