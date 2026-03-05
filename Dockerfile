FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm && pnpm install

COPY apps /app/apps
COPY packages /app/packages

RUN pnpm install --force

RUN cd /app/packages/db && pnpm exec prisma generate

RUN pnpm -F server build

RUN pnpm -F web build

FROM node:20-alpine AS runner
WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/apps/web/dist /app/dist

EXPOSE 80

CMD ["serve", "-s", "/app/dist", "-l", "80"]
