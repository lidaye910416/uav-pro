#!/bin/bash
# UAV-PRO 服务管理脚本 (使用 PM2 守护进程)
# 设置颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# PM2 配置目录
PM2_HOME="$PROJECT_ROOT/.pm2"

# ==================== 加载服务配置 ====================
# 从 config/services.json 读取端口配置
load_service_config() {
    # 默认端口: 8888(后端), 4000(showcase), 4001(dashboard), 4002(admin)
    export BACKEND_PORT=${BACKEND_PORT:-8888}
    export BACKEND_HOST=${BACKEND_HOST:-127.0.0.1}
    export OLLAMA_PORT=${OLLAMA_PORT:-11434}
    export SHOWCASE_PORT=${SHOWCASE_PORT:-4000}
    export DASHBOARD_PORT=${DASHBOARD_PORT:-4001}
    export ADMIN_PORT=${ADMIN_PORT:-4002}

    # 如果存在 .env 文件，加载它
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a  # 自动导出
        source "$PROJECT_ROOT/.env"
        set +a
    fi
}

load_service_config

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

# 使用 PM2 停止所有服务
stop_all() {
    echo -e "${YELLOW}停止所有服务 (PM2)...${NC}"
    cd "$PM2_HOME" 2>/dev/null || true
    pm2 delete all 2>/dev/null || true
    pm2 kill 2>/dev/null || true

    # 也杀掉残留进程
    pkill -f "uvicorn main:app" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    pkill -f "ollama serve" 2>/dev/null || true
    sleep 2
    echo -e "${GREEN}✓ 所有服务已停止${NC}"
}

# 启动 Ollama
start_ollama() {
    echo -e "${YELLOW}启动 Ollama (端口 $OLLAMA_PORT)...${NC}"
    if pgrep -f "ollama serve" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama 已在运行${NC}"
        return 0
    fi

    # 使用 PM2 启动
    pm2 start --name "uav-ollama" --no-autorestart -- \
        ollama serve > /tmp/ollama.log 2>&1 &
    sleep 3

    if curl -s --max-time 5 http://localhost:$OLLAMA_PORT/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama 已启动${NC}"
    else
        echo -e "${RED}✗ Ollama 启动失败${NC}"
        tail -5 /tmp/ollama.log
    fi
}

# 启动后端 (PM2 守护)
start_backend() {
    echo -e "${YELLOW}启动后端 (端口 $BACKEND_PORT, PM2 守护)...${NC}"

    cd "$PROJECT_ROOT/backend"
    export PYTHONPATH="$PROJECT_ROOT/backend"

    pm2 start \
        --name "uav-backend" \
        --no-autorestart \
        -- \
        python3 -m uvicorn main:app --host $BACKEND_HOST --port $BACKEND_PORT

    cd "$PROJECT_ROOT"
    sleep 4

    if curl -s http://localhost:$BACKEND_PORT/docs > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端已启动 (PM2 守护中)${NC}"
    else
        echo -e "${RED}✗ 后端启动失败${NC}"
        pm2 logs uav-backend --lines 10 --nostream
    fi
}

# 启动前端 (使用 Turbo 通过 PM2)
start_frontend() {
    echo -e "${YELLOW}启动前端服务 (PM2 守护)...${NC}"

    cd "$PROJECT_ROOT/frontend"

    # 使用 Turbo 启动前端应用
    # Turbo 会同时启动 showcase, dashboard, admin
    pm2 start \
        --name "uav-frontend" \
        --no-autorestart \
        -- \
        pnpm dev

    sleep 10

    # 检查所有前端服务
    local all_ok=true
    for port in $SHOWCASE_PORT $DASHBOARD_PORT $ADMIN_PORT; do
        if curl -s --max-time 3 http://localhost:$port > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} 端口 $port"
        else
            echo -e "  ${RED}✗${NC} 端口 $port (等待中...)"
            all_ok=false
        fi
    done

    if [ "$all_ok" = true ]; then
        echo -e "${GREEN}✓ 前端服务已启动 (PM2 守护中)${NC}"
    else
        echo -e "${YELLOW}部分前端服务正在启动，请稍后...${NC}"
    fi
}

# 检查服务状态
check_status() {
    echo ""
    echo "=========================================="
    echo -e "         ${BLUE}服务状态检查 (PM2)${NC}"
    echo "=========================================="

    echo -e "\n${YELLOW}PM2 进程列表:${NC}"
    pm2 list

    echo ""
    echo -e "${YELLOW}HTTP 服务检测:${NC}"

    local all_ok=true
    for name in "Ollama:$OLLAMA_PORT" "Backend:$BACKEND_PORT" "Showcase:$SHOWCASE_PORT" "Dashboard:$DASHBOARD_PORT" "Admin:$ADMIN_PORT"; do
        service="${name%%:*}"
        port="${name##*:}"

        if curl -s --max-time 2 http://localhost:$port > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} $service (端口 $port)"
        else
            echo -e "  ${RED}✗${NC} $service (端口 $port - 离线)"
            all_ok=false
        fi
    done

    echo ""
    if [ "$all_ok" = true ]; then
        echo -e "${GREEN}所有服务运行正常!${NC}"
    else
        echo -e "${YELLOW}部分服务离线，可使用 '$0 restart' 重启${NC}"
    fi
    echo "=========================================="
}

# 清理并重启 (处理端口占用问题)
clean_restart() {
    echo -e "${YELLOW}清理残留进程...${NC}"
    pkill -9 -f "next" 2>/dev/null || true
    pkill -9 -f "node.*showcase" 2>/dev/null || true
    pkill -9 -f "node.*dashboard" 2>/dev/null || true
    pkill -9 -f "node.*admin" 2>/dev/null || true
    pkill -9 -f "uvicorn" 2>/dev/null || true
    lsof -ti:$SHOWCASE_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$DASHBOARD_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$ADMIN_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    sleep 3
    echo -e "${GREEN}清理完成${NC}"
}

# 主流程
case "${1:-start}" in
    start)
        init_database
        stop_all
        start_ollama
        start_backend
        start_frontend
        sleep 3
        check_status
        ;;
    stop)
        stop_all
        ;;
    restart)
        init_database
        clean_restart
        stop_all
        start_ollama
        start_backend
        start_frontend
        sleep 3
        check_status
        ;;
    status)
        check_status
        ;;
    logs)
        echo -e "${YELLOW}查看后端日志:${NC}"
        pm2 logs uav-backend --lines 50 --nostream
        ;;
    clean)
        clean_restart
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs|clean}"
        echo ""
        echo "  start   - 启动所有服务 (PM2 守护)"
        echo "  stop    - 停止所有服务"
        echo "  restart - 重启所有服务"
        echo "  status  - 检查服务状态"
        echo "  logs    - 查看后端日志"
        echo "  clean   - 清理残留进程"
        exit 1
        ;;
esac
