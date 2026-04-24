FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/showcase/package.json apps/showcase/

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

EXPOSE 3001

CMD ["pnpm", "dev"]
