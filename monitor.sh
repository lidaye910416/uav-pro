#!/bin/bash
# 服务监控脚本 - 检测挂掉的服务并自动重启

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/service_monitor.log"

# ==================== 加载服务配置 ====================
load_service_config() {
    export BACKEND_PORT=${BACKEND_PORT:-8000}
    export BACKEND_HOST=${BACKEND_HOST:-127.0.0.1}
    export SHOWCASE_PORT=${SHOWCASE_PORT:-3000}
    export DASHBOARD_PORT=${DASHBOARD_PORT:-3001}
    export ADMIN_PORT=${ADMIN_PORT:-3002}

    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
}

load_service_config

check_and_restart() {
    local name=$1
    local port=$2
    local dir=$3
    local log=$4

    if ! curl -s --max-time 3 "http://localhost:$port" > /dev/null 2>&1; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $name 离线，正在重启..." >> "$LOG_FILE"

        # 停止可能存在的进程
        if [ -n "$dir" ]; then
            pkill -f "port.*$port" 2>/dev/null || true
        fi

        # 重启服务
        if [ "$port" = "$BACKEND_PORT" ]; then
            cd "$PROJECT_ROOT/backend" 2>/dev/null
            nohup env PYTHONPATH="$PROJECT_ROOT/backend" python3 -m uvicorn main:app --host $BACKEND_HOST --port $BACKEND_PORT >> "$log" 2>&1 &
        elif [ "$port" = "$SHOWCASE_PORT" ]; then
            cd "$PROJECT_ROOT/frontend/apps/showcase" 2>/dev/null
            nohup npm run dev >> "$log" 2>&1 &
        elif [ "$port" = "$DASHBOARD_PORT" ]; then
            cd "$PROJECT_ROOT/frontend/apps/dashboard" 2>/dev/null
            nohup npm run dev -- -p $DASHBOARD_PORT >> "$log" 2>&1 &
        elif [ "$port" = "$ADMIN_PORT" ]; then
            cd "$PROJECT_ROOT/frontend/apps/admin" 2>/dev/null
            nohup npm run dev -- -p $ADMIN_PORT >> "$log" 2>&1 &
        fi

        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $name 已重启" >> "$LOG_FILE"
    fi
}

# 监控循环
while true; do
    check_and_restart "Backend" $BACKEND_PORT "$PROJECT_ROOT/backend" "/tmp/backend.log"
    check_and_restart "Showcase" $SHOWCASE_PORT "$PROJECT_ROOT/frontend/apps/showcase" "/tmp/showcase.log"
    check_and_restart "Dashboard" $DASHBOARD_PORT "$PROJECT_ROOT/frontend/apps/dashboard" "/tmp/dashboard.log"
    check_and_restart "Admin" $ADMIN_PORT "$PROJECT_ROOT/frontend/apps/admin" "/tmp/admin.log"
    sleep 30
done
