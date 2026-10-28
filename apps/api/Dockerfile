# Сборка из корня репозитория: docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @heroes/api --include-workspace-root=false --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
ENV NODE_ENV=production
EXPOSE 3000
# Миграции → идемпотентный seed → сервер
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && exec npx tsx src/server.ts"]
