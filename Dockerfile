FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/
COPY packages/logger/package.json ./packages/logger/

RUN npm install -g pnpm && pnpm install

COPY apps/ ./apps/
COPY packages/ ./packages/

RUN cd packages/db && pnpm exec prisma generate
RUN pnpm -F web build
RUN cd apps/server && pnpm build

FROM base AS runner

RUN npm install -g serve concurrently

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 app

RUN mkdir -p /app/uploads/images /app/uploads/files && chown -R app:nodejs /app/uploads

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/web/dist ./apps/web/dist/
COPY --from=builder /app/apps/server/dist ./apps/server/dist/
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/packages/db/node_modules/.prisma/client ./node_modules/.prisma/client/
COPY --from=builder /app/packages/db/node_modules/@prisma ./node_modules/@prisma/
COPY --from=builder /app/packages/logger/src ./packages/logger/src/
COPY --from=builder /app/packages/logger/package.json ./packages/logger/
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules/

USER app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 80 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["sh", "-c", "concurrently --kill-others \"serve -s /app/apps/web/dist -l 80\" \"node /app/apps/server/dist/index.js\""]
