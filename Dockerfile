FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY --from=oven/bun:1 /usr/local/bin/pnpm /usr/local/bin/pnpm
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
COPY package.json pnpm-lock.yaml ./
COPY --from=oven/bun:1 /usr/local/bin/pnpm /usr/local/bin/pnpm
RUN pnpm install --frozen-lockfile

COPY apps/web apps/server packages packages/db /app/
COPY prisma /app/packages/db/prisma

WORKDIR /app/packages/db
RUN pnpm prisma generate

WORKDIR /app/apps/server
RUN pnpm build

WORKDIR /app/apps/web
RUN pnpm build

FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY --from=builder /app/packages/db/prisma /docker-entrypoint.d/prisma
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nginx

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
