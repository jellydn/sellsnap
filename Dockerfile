FROM node:20-alpine
WORKDIR /app

ARG VITE_API_URL
ARG BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ENV VITE_API_URL=$VITE_API_URL
ENV BUILD_DATE=$BUILD_DATE
ENV NODE_ENV=production

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

RUN npm install -g serve concurrently tsx

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 app

RUN mkdir -p /app/uploads/images /app/uploads/files && chown -R app:nodejs /app/uploads

USER app

ENV PORT=3000
ENV API_PORT=80
ENV API_URL=https://store.itman.fyi
ENV MAX_UPLOAD_SIZE=20971520

EXPOSE 80 3000 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["sh", "-c", "serve -s /app/apps/web/dist -l 8080 & npx tsx /app/apps/server/src/index.ts"]
