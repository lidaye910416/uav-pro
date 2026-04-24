#!/bin/bash
# =============================================================================
# 使用 PM2 启动所有服务
# =============================================================================

cd "$(dirname "$0")"

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "PM2 未安装，正在安装..."
    npm install -g pm2
fi

# 启动服务
pm2 start ecosystem.config.js

# 保存配置
pm2 save

# 设置开机自启
pm2 startup

echo ""
echo "服务已启动！"
echo "查看状态: pm2 status"
echo "查看日志: pm2 logs"
