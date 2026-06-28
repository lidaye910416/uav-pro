#!/bin/bash
# UAV-PRO 服务管理脚本 (基于 docker-compose)
# 端口配置：仅修改本文件第 19-25 行的默认值即可（勿改 .env）

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# ── 颜色 ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── 端口默认值（端口单一来源，勿在 .env 中配置）────────────────────────────
export BACKEND_PORT=${BACKEND_PORT:-8888}
export OLLAMA_PORT=${OLLAMA_PORT:-11434}
export CHROMA_PORT=${CHROMA_PORT:-9001}
export SHOWCASE_PORT=${SHOWCASE_PORT:-4000}
export DASHBOARD_PORT=${DASHBOARD_PORT:-4001}
export ADMIN_PORT=${ADMIN_PORT:-4002}

# 加载 .env 中非端口配置（如 SECRET_KEY / MODEL_GEMMA4 / PIPELINE_MODE）
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # 仅加载非端口配置
    grep -v -E '^[A-Z_]+_PORT=' "$PROJECT_ROOT/.env" | grep -v '^BACKEND_HOST=' || true
    set +a
fi

# ── 子命令 ──────────────────────────────────────────────────────────────────
usage() {
    cat <<EOF
用法: $0 {start|stop|restart|status|logs|clean}

  start    构建镜像并启动所有服务 (Ollama + ChromaDB + Backend + 3 前端)
  stop     停止所有容器
  restart  重启所有服务
  status   查看容器状态与端口健康检查
  logs     查看所有容器日志 (用法: $0 logs [service])
  clean    删除所有容器、网络与卷（数据将丢失）

端口修改: 编辑本文件第 19-25 行
EOF
}

wait_healthy() {
    local service=$1
    local max_wait=${2:-120}
    echo -ne "${YELLOW}  等待 $service 健康...${NC}"
    for i in $(seq 1 $max_wait); do
        if docker compose ps "$service" 2>/dev/null | grep -q "healthy"; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        sleep 2
    done
    echo -e " ${RED}超时${NC}"
    return 1
}

check_status() {
    echo ""
    echo "=========================================="
    echo -e "         ${BLUE}服务状态 (docker-compose)${NC}"
    echo "=========================================="
    docker compose ps

    echo ""
    echo -e "${YELLOW}HTTP 健康检查:${NC}"
    local all_ok=true
    for name_port in "Backend:http://localhost:$BACKEND_PORT/health" \
                     "Showcase:http://localhost:$SHOWCASE_PORT" \
                     "Dashboard:http://localhost:$DASHBOARD_PORT" \
                     "Admin:http://localhost:$ADMIN_PORT" \
                     "Ollama:http://localhost:$OLLAMA_PORT/api/tags" \
                     "ChromaDB:http://localhost:$CHROMA_PORT/api/v1/heartbeat"; do
        name="${name_port%%:*}"
        url="${name_port#*:}"
        if curl -s --max-time 3 "$url" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} $name  ($url)"
        else
            echo -e "  ${RED}✗${NC} $name  ($url 离线)"
            all_ok=false
        fi
    done

    echo ""
    if [ "$all_ok" = true ]; then
        echo -e "${GREEN}所有服务运行正常${NC}"
    else
        echo -e "${YELLOW}部分服务离线，运行 '$0 logs' 查看详情${NC}"
    fi
    echo "=========================================="
}

case "${1:-start}" in
    start)
        echo -e "${YELLOW}构建并启动所有服务...${NC}"
        docker compose up -d --build
        wait_healthy backend 120
        wait_healthy showcase 90
        wait_healthy dashboard 90
        wait_healthy admin 90
        sleep 2
        check_status
        ;;
    stop)
        echo -e "${YELLOW}停止所有服务...${NC}"
        docker compose down
        echo -e "${GREEN}✓ 已停止${NC}"
        ;;
    restart)
        echo -e "${YELLOW}重启所有服务...${NC}"
        docker compose restart
        sleep 5
        check_status
        ;;
    status)
        check_status
        ;;
    logs)
        docker compose logs -f --tail=100 "${2:-}"
        ;;
    clean)
        echo -e "${RED}警告: 这将删除所有容器、网络和卷 (ChromaDB 数据将丢失)${NC}"
        read -p "确认? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker compose down -v
            echo -e "${GREEN}✓ 已清理${NC}"
        fi
        ;;
    -h|--help|help|"")
        usage
        ;;
    *)
        echo "未知命令: $1"
        usage
        exit 1
        ;;
esac
