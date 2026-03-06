FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm && pnpm install

COPY apps /app/apps
COPY packages /app/packages

RUN pnpm install --force

RUN cd /app/packages/db && pnpm exec prisma generate

RUN pnpm -F web build

FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g serve tsx concurrently

COPY --from=builder /app /app

ENV NODE_ENV=production
ENV BETTER_AUTH_SECRET=dev-secret-change-in-production-minimum-32-chars

EXPOSE 80

CMD ["sh", "-c", "concurrently --kill-others \"serve -s /app/apps/web/dist -l 80\" \"tsx /app/apps/server/src/index.ts\""]
