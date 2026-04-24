#!/bin/bash
# =============================================================================
# UAV-PRO 启动脚本
# 无人机低空检测智能安全预警系统
# =============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  UAV-PRO 无人机低空检测智能安全预警系统 启动脚本${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# =============================================================================
# 1. 检查 Python 环境
# =============================================================================
echo -e "${YELLOW}[1/6] 检查 Python 环境...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ 错误: 未找到 python3，请先安装 Python 3.10+${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo -e "${GREEN}✓ Python $PYTHON_VERSION${NC}"

# =============================================================================
# 2. 安装 Python 依赖
# =============================================================================
echo -e "${YELLOW}[2/6] 安装 Python 依赖...${NC}"

if [ -f "$PROJECT_ROOT/backend/requirements.txt" ]; then
    # 检查是否需要安装
    if ! python3 -c "import fastapi" 2>/dev/null || [ "$1" == "--reinstall" ]; then
        echo "  安装后端依赖..."
        pip3 install -r "$PROJECT_ROOT/backend/requirements.txt" --quiet
        echo -e "${GREEN}✓ Python 依赖安装完成${NC}"
    else
        echo -e "${GREEN}✓ Python 依赖已安装${NC}"
    fi
else
    echo -e "${YELLOW}⚠ 未找到 requirements.txt，跳过${NC}"
fi

# =============================================================================
# 3. 安装 npm 依赖
# =============================================================================
echo -e "${YELLOW}[3/6] 安装 npm 依赖...${NC}"

# 安装根目录前端依赖
if [ -f "$PROJECT_ROOT/frontend/package.json" ]; then
    if [ ! -d "$PROJECT_ROOT/frontend/node_modules" ] || [ "$1" == "--reinstall" ]; then
        echo "  安装前端根目录依赖..."
        cd "$PROJECT_ROOT/frontend"
        npm install --silent
        cd "$PROJECT_ROOT"
        echo -e "${GREEN}✓ 前端根目录依赖安装完成${NC}"
    else
        echo -e "${GREEN}✓ 前端根目录依赖已安装${NC}"
    fi
else
    echo -e "${YELLOW}⚠ 未找到 package.json，跳过${NC}"
fi

# 安装各前端应用的依赖
for app in showcase dashboard admin; do
    APP_DIR="$PROJECT_ROOT/frontend/apps/$app"
    if [ -d "$APP_DIR" ]; then
        if [ ! -d "$APP_DIR/node_modules" ] || [ "$1" == "--reinstall" ]; then
            echo "  安装 $app 依赖..."
            cd "$APP_DIR"
            npm install --silent
            cd "$PROJECT_ROOT"
            echo -e "${GREEN}✓ $app 依赖安装完成${NC}"
        else
            echo -e "${GREEN}✓ $app 依赖已安装${NC}"
        fi
    fi
done

# =============================================================================
# 4. 检查模型文件
# =============================================================================
echo -e "${YELLOW}[4/6] 检查模型文件...${NC}"

MODEL_DIR="$PROJECT_ROOT/backend/models"
mkdir -p "$MODEL_DIR"

check_model() {
    local model_path="$1"
    local model_name="$2"
    local download_url="$3"
    
    if [ -f "$model_path" ]; then
        echo -e "${GREEN}✓ $model_name 已存在 ($(du -h "$model_path" | cut -f1))${NC}"
    else
        echo -e "${YELLOW}⚠ $model_name 不存在${NC}"
        if [ -n "$download_url" ]; then
            read -p "  是否下载? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "  正在下载 $model_name..."
                curl -L -o "$model_path" "$download_url" --progress-bar
                echo -e "${GREEN}✓ $model_name 下载完成${NC}"
            fi
        fi
    fi
}

# 检查 YOLO 模型
check_model "$PROJECT_ROOT/backend/yolov8n.pt" "YOLOv8n" "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt"
check_model "$PROJECT_ROOT/backend/yolov8l.pt" "YOLOv8l" "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8l.pt"

# 检查 SAM 模型
check_model "$PROJECT_ROOT/backend/models/sam/sam_vit_b.pth" "SAM ViT-B" "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"

# =============================================================================
# 5. 创建必要的目录
# =============================================================================
echo -e "${YELLOW}[5/6] 创建必要目录...${NC}"

mkdir -p "$PROJECT_ROOT/backend/data/streams"
mkdir -p "$PROJECT_ROOT/backend/data/frames"
mkdir -p "$PROJECT_ROOT/backend/data/knowledge_base"

# 创建 .gitkeep 文件
touch "$PROJECT_ROOT/backend/data/streams/.gitkeep"
touch "$PROJECT_ROOT/backend/data/frames/.gitkeep"
touch "$PROJECT_ROOT/backend/data/knowledge_base/.gitkeep"

echo -e "${GREEN}✓ 目录创建完成${NC}"

# =============================================================================
# 6. 启动服务
# =============================================================================
echo -e "${YELLOW}[6/6] 启动服务...${NC}"
echo ""

# 停止已有进程
echo -e "${BLUE}停止已有进程...${NC}"
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

# 启动后端
echo -e "  启动后端 (端口 8000)..."
cd "$PROJECT_ROOT/backend"
nohup env PYTHONPATH="$PROJECT_ROOT/backend" python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 > /dev/null 2>&1 &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# 启动前端 showcase
if [ -d "$PROJECT_ROOT/frontend/apps/showcase" ]; then
    echo -e "  启动前端 Showcase (端口 3000)..."
    cd "$PROJECT_ROOT/frontend/apps/showcase"
    nohup npm run dev > /dev/null 2>&1 &
    cd "$PROJECT_ROOT"
fi

# 启动前端 dashboard
if [ -d "$PROJECT_ROOT/frontend/apps/dashboard" ]; then
    echo -e "  启动前端 Dashboard (端口 3001)..."
    cd "$PROJECT_ROOT/frontend/apps/dashboard"
    nohup npm run dev > /dev/null 2>&1 &
    cd "$PROJECT_ROOT"
fi

# 启动前端 admin
if [ -d "$PROJECT_ROOT/frontend/apps/admin" ]; then
    echo -e "  启动前端 Admin (端口 3002)..."
    cd "$PROJECT_ROOT/frontend/apps/admin"
    nohup npm run dev > /dev/null 2>&1 &
    cd "$PROJECT_ROOT"
fi

# 等待服务启动
echo ""
echo -e "${BLUE}等待服务启动...${NC}"
sleep 15

# 检查服务状态
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ 所有服务已启动！${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  服务地址:"
echo "  - 后端 API:     http://localhost:8000"
echo "  - 展示首页:     http://localhost:3000"
echo "  - 监控面板:     http://localhost:3001"
echo "  - 管理后台:     http://localhost:3002"
echo ""
echo "  停止服务: pkill -f 'uvicorn main:app' && pkill -f 'next dev'"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
