FROM node:20-alpine

WORKDIR /app

# Copy all package.json files for workspace
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml frontend/turbo.json ./
COPY frontend/apps/dashboard/ apps/dashboard/
COPY frontend/apps/showcase/ apps/showcase/
COPY frontend/apps/admin/ apps/admin/

# Install dependencies - use npm install first for faster initial install
RUN npm install -g pnpm@9.0.0 && pnpm install --prefer-offline

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

EXPOSE 3001

CMD ["pnpm", "dev"]
