#!/bin/bash
# UAV-PRO 服务管理脚本 (使用 PM2 ecosystem.config.js)
# 设置颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# ============================================================
# 端口配置 — 只需修改这里，所有服务 + 按钮 URL 自动同步
# ============================================================
export BACKEND_PORT=${BACKEND_PORT:-8888}
export CHROMADB_PORT=${CHROMADB_PORT:-8001}
export OLLAMA_PORT=${OLLAMA_PORT:-11434}
# 前端端口（Next.js）：修改后 ecosystem.config.js + 按钮 URL 自动更新
export SHOWCASE_PORT=${SHOWCASE_PORT:-3000}
export DASHBOARD_PORT=${DASHBOARD_PORT:-3001}
export ADMIN_PORT=${ADMIN_PORT:-3002}

# 动态生成 ecosystem.config.js（端口换一处就改这里）
write_ecosystem_config() {
    cat > "$PROJECT_ROOT/ecosystem.config.js" << EOF
module.exports = {
  apps: [
    {
      name: 'uav-chromadb',
      script: 'bash',
      args: 'start_chromadb.sh',
      cwd: '$PROJECT_ROOT/backend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
      env: {
        PYTHONPATH: '$PROJECT_ROOT/backend'
      }
    },
    {
      name: 'uav-backend',
      script: 'bash',
      args: 'start_backend.sh',
      cwd: '$PROJECT_ROOT/backend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
      env: {
        PYTHONPATH: '$PROJECT_ROOT/backend'
      }
    },
    {
      name: 'uav-showcase',
      script: 'bash',
      args: '-c "PORT=$SHOWCASE_PORT pnpm --filter @uav/showcase dev"',
      cwd: '$PROJECT_ROOT/frontend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
    },
    {
      name: 'uav-dashboard',
      script: 'bash',
      args: '-c "PORT=$DASHBOARD_PORT pnpm --filter @uav/dashboard dev"',
      cwd: '$PROJECT_ROOT/frontend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
    },
    {
      name: 'uav-admin',
      script: 'bash',
      args: '-c "PORT=$ADMIN_PORT pnpm --filter @uav/admin dev"',
      cwd: '$PROJECT_ROOT/frontend',
      interpreter: 'none',
      autorestart: false,
      watch: false,
    }
  ]
};
EOF
    echo "  ecosystem.config.js 已生成（前端端口: $SHOWCASE_PORT / $DASHBOARD_PORT / $ADMIN_PORT）"

    # 生成前端 .env.local 文件（Next.js 读取 NEXT_PUBLIC_* 变量）
    mkdir -p "$PROJECT_ROOT/frontend/apps/showcase"
    mkdir -p "$PROJECT_ROOT/frontend/apps/dashboard"
    mkdir -p "$PROJECT_ROOT/frontend/apps/admin"

    cat > "$PROJECT_ROOT/frontend/apps/showcase/.env.local" << EOF
NEXT_PUBLIC_BACKEND_PORT=$BACKEND_PORT
NEXT_PUBLIC_CHROMADB_PORT=$CHROMADB_PORT
EOF
    cat > "$PROJECT_ROOT/frontend/apps/dashboard/.env.local" << EOF
NEXT_PUBLIC_BACKEND_PORT=$BACKEND_PORT
NEXT_PUBLIC_CHROMADB_PORT=$CHROMADB_PORT
EOF
    cat > "$PROJECT_ROOT/frontend/apps/admin/.env.local" << EOF
NEXT_PUBLIC_BACKEND_PORT=$BACKEND_PORT
NEXT_PUBLIC_CHROMADB_PORT=$CHROMADB_PORT
EOF
    echo "  前端 .env.local 已生成"
}

# ==================== Ollama 检查 ====================
start_ollama() {
    echo -e "${YELLOW}检查 Ollama...${NC}"
    if pgrep -f "ollama serve" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ollama 已在运行${NC}"
    else
        echo -e "${YELLOW}启动 Ollama...${NC}"
        ollama serve > /tmp/ollama.log 2>&1 &
        sleep 3
    fi
}

# ==================== PM2 启动/停止 ====================
start_all() {
    echo -e "${YELLOW}生成服务配置...${NC}"
    write_ecosystem_config

    echo -e "${YELLOW}启动所有服务 (PM2)...${NC}"
    pm2 start ecosystem.config.js 2>&1
    sleep 10

    # 验证后端
    if curl -s --max-time 5 http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 后端已启动 (PM2 守护中)${NC}"
    else
        echo -e "${RED}✗ 后端启动失败${NC}"
        pm2 logs uav-backend --lines 15 --nostream
    fi

    # 验证 ChromaDB
    if curl -s --max-time 5 http://localhost:$CHROMADB_PORT/api/v1/heartbeat > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ChromaDB 已启动${NC}"
    else
        echo -e "${RED}✗ ChromaDB 启动失败${NC}"
    fi
}

stop_all() {
    echo -e "${YELLOW}停止所有服务 (PM2)...${NC}"
    pm2 delete all 2>/dev/null || true
    pkill -f "uvicorn main:app" 2>/dev/null || true
    pkill -f "uvicorn chromadb" 2>/dev/null || true
    pkill -f "next" 2>/dev/null || true
    sleep 1
    echo -e "${GREEN}✓ 所有服务已停止${NC}"
}

check_status() {
    echo ""
    echo "=========================================="
    echo -e "         ${BLUE}服务状态检查${NC}"
    echo "=========================================="
    pm2 list 2>/dev/null
    echo ""
    echo -e "${YELLOW}HTTP 服务检测:${NC}"
    local all_ok=true
    for name in "Ollama:$OLLAMA_PORT" "ChromaDB:$CHROMADB_PORT" "Backend:$BACKEND_PORT" "Showcase:$SHOWCASE_PORT" "Dashboard:$DASHBOARD_PORT" "Admin:$ADMIN_PORT"; do
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
        echo -e "${YELLOW}部分服务离线${NC}"
    fi
    echo "=========================================="
}

# 主流程
case "${1:-start}" in
    start)
        start_ollama
        start_all
        sleep 3
        check_status
        ;;
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 2
        start_ollama
        start_all
        sleep 3
        check_status
        ;;
    status)
        check_status
        ;;
    logs)
        echo -e "${YELLOW}后端日志:${NC}"
        pm2 logs uav-backend --lines 30 --nostream
        echo -e "${YELLOW}ChromaDB 日志:${NC}"
        cat /tmp/chromadb.log 2>/dev/null | tail -20
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
