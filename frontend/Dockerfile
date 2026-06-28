FROM node:20-alpine

WORKDIR /app

# 构建参数：APP_NAME 指定要启动的子应用 (showcase/dashboard/admin)
ARG APP_NAME=showcase
ENV APP_NAME=${APP_NAME}

# 复制 workspace 根配置
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml frontend/turbo.json ./
COPY frontend/apps/ apps/
COPY frontend/packages/ packages/

RUN npm install -g pnpm@9.0.0 && pnpm install --prefer-offline

ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# 仅启动指定子应用，PORT 决定监听端口
CMD ["sh", "-c", "cd apps/${APP_NAME} && pnpm dev"]
