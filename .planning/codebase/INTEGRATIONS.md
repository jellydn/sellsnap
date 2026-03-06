# External Integrations

**Analysis Date:** 2026-03-06

## APIs & External Services

### Stripe (Payment Processing)

| Aspect           | Detail                                          |
| ---------------- | ------------------------------------------------ |
| SDK              | `stripe` ^20.4.0                                 |
| Init             | `apps/server/src/lib/stripe.ts` — lazy init with `STRIPE_SECRET_KEY` |
| Checkout         | `POST /api/checkout/:productSlug` → `stripe.checkout.sessions.create()` |
| Payment mode     | One-time (`mode: "payment"`)                     |
| Payment methods  | Card only (`payment_method_types: ["card"]`)     |
| Currency         | USD                                              |
| Metadata         | `productId` attached to checkout session         |
| Webhooks         | `POST /api/webhooks/stripe` — signature verified via `STRIPE_WEBHOOK_SECRET` |
| Events handled   | `checkout.session.completed`                     |

**Checkout flow:**
1. Frontend calls `POST /api/checkout/:productSlug` with optional `customerEmail`
2. Server creates Stripe Checkout Session with product details
3. Returns `{ url }` — frontend redirects to Stripe hosted checkout
4. Stripe sends webhook on completion → server creates `Purchase` record
5. Download link emailed to customer (24h expiry)

### Email (Stub)

| Aspect   | Detail                                                  |
| -------- | ------------------------------------------------------- |
| Location | `apps/server/src/lib/email.ts`                          |
| Dev mode | Logs email to console via `logger.box()`                |
| Prod     | **Not implemented** — throws error                      |
| Usage    | Post-purchase confirmation with download link           |

> No external email provider is integrated yet. Production email sending must be implemented.

## Data Storage

### PostgreSQL

| Aspect     | Detail                                          |
| ---------- | ------------------------------------------------ |
| Version    | 16-alpine (Docker)                               |
| ORM        | Prisma ^6.19.2                                   |
| Schema     | `packages/db/prisma/schema.prisma`               |
| Connection | `DATABASE_URL` env var                           |
| Client     | Singleton in `apps/server/src/lib/prisma.ts`     |

**Schema models:**

| Model      | Key Fields                                                    |
| ---------- | ------------------------------------------------------------- |
| `User`     | id (cuid), name, email (unique), slug (unique), avatarUrl     |
| `Product`  | id, title, slug (unique), description, price (int/cents), coverImageUrl, filePath, published, viewCount, creatorId → User |
| `Purchase` | id, productId → Product, customerEmail, stripePaymentIntentId, stripeSessionId, amount, status, downloadToken (unique), downloadExpiresAt |

> Note: better-auth creates additional tables (session, account, verification) not shown in the user-managed schema.

### File Storage (Local Filesystem)

| Aspect     | Detail                                          |
| ---------- | ------------------------------------------------ |
| Location   | `apps/server/src/lib/upload.ts`                  |
| Images dir | `{cwd}/uploads/images/` — served via `@fastify/static` at `/uploads/images/` |
| Files dir  | `{cwd}/uploads/files/` — stored but not publicly served |
| Naming     | UUID-based filenames to prevent collisions        |
| Validation | Image MIME types: jpeg, png, gif, webp, svg+xml  |
| Size limit | Configurable via `MAX_UPLOAD_SIZE` env (default 10MB) |

## Authentication & Identity

### better-auth

| Aspect      | Detail                                           |
| ----------- | ------------------------------------------------ |
| Library     | `better-auth` ^1.5.3                             |
| Server init | `apps/server/src/lib/auth.ts` — `betterAuth()` with Prisma adapter |
| Client init | `apps/web/src/lib/auth.ts` — `createAuthClient()` from `better-auth/react` |
| DB adapter  | `prismaAdapter` with PostgreSQL provider          |
| Auth method | Email + password (`emailAndPassword: { enabled: true }`) |
| Routes      | `GET/POST /api/auth/*` — Fastify delegates to `auth.handler()` |
| Session     | `authClient.useSession()` React hook via `apps/web/src/lib/session.ts` |
| Base URL    | `FRONTEND_URL` env var (default `http://localhost:5173`) |

**Auth flow:**
1. Client uses `better-auth/react` hooks for sign-up/sign-in
2. Server route `/api/auth/*` passes raw Request to `auth.handler()`
3. better-auth manages sessions via cookies and Prisma-backed storage
4. `ProtectedRoute` component gates authenticated pages (Dashboard, Settings, etc.)

## Monitoring & Observability

### Logging

| Layer   | Tool                                     |
| ------- | ---------------------------------------- |
| Server  | Fastify built-in logger (`logger: true`) |
| App     | `@sellsnap/logger` (consola wrapper)     |

- **consola** configured with log levels: verbose (4) in dev, info (3) in production
- Configurable via `LOG_LEVEL` env var
- `createLogger(prefix)` factory for tagged loggers

### Rate Limiting

| Scope  | Config                                |
| ------ | ------------------------------------- |
| Global | 100 requests/minute via `@fastify/rate-limit` |
| Checkout | 20 requests/minute (per-route override) |

### Health Check

- `GET /api/health` route registered via `apps/server/src/routes/health.ts`

## CI/CD & Deployment

### Pre-commit Hooks

- **prek** (bun-based) runs Biome check on `.ts/.tsx/.js/.jsx` files
- Config: `.pre-commit-config.yaml` → `biome check --write` on both `apps/web` and `apps/server`

### Docker Deployment

| Image              | Dockerfile          | Ports | Description                        |
| ------------------ | ------------------- | ----- | ---------------------------------- |
| Combined (web+api) | `Dockerfile`        | 80    | `serve` for static + `tsx` for API via `concurrently` |
| Server-only        | `Dockerfile.server` | 3000  | API server with non-root user, uploads dirs |

### Docker Compose

- **Services:** `web` (combined app) + `db` (PostgreSQL 16-alpine)
- **Networking:** bridge network `sellsnap`
- **Health checks:** `pg_isready` on PostgreSQL
- **Volumes:** `postgres_data` for database persistence

### Task Runner

- **just** (justfile) — shortcuts for install, dev, typecheck, build, lint, test, Prisma commands

## Environment Configuration

### Root `.env.example`

| Variable               | Purpose                         | Default                        |
| ---------------------- | ------------------------------- | ------------------------------ |
| `DATABASE_URL`         | PostgreSQL connection string    | `postgresql://sellsnap:sellsnap@db:5432/sellsnap` |
| `STRIPE_SECRET_KEY`    | Stripe API secret key           | —                              |
| `STRIPE_WEBHOOK_SECRET`| Stripe webhook signing secret   | —                              |
| `FRONTEND_URL`         | Frontend base URL               | `http://localhost`             |
| `POSTGRES_USER`        | Docker PostgreSQL user          | `sellsnap`                     |
| `POSTGRES_PASSWORD`    | Docker PostgreSQL password      | `sellsnap`                     |
| `POSTGRES_DB`          | Docker PostgreSQL database name | `sellsnap`                     |

### Server `.env.example` (`apps/server/.env.example`)

| Variable               | Purpose                         | Default                        |
| ---------------------- | ------------------------------- | ------------------------------ |
| `DATABASE_URL`         | PostgreSQL connection string    | —                              |
| `BETTER_AUTH_SECRET`   | Auth session signing secret     | —                              |
| `STRIPE_SECRET_KEY`    | Stripe API secret key           | —                              |
| `STRIPE_WEBHOOK_SECRET`| Stripe webhook signing secret   | —                              |
| `FRONTEND_URL`         | Frontend base URL               | `http://localhost:5173`        |
| `MAX_UPLOAD_SIZE`      | Max file upload bytes           | `10485760` (10MB)              |

### Build-time Variables

| Variable       | Usage                           |
| -------------- | ------------------------------- |
| `VITE_API_URL` | API base URL injected at build time (Docker ARG → Vite `import.meta.env`) |

### Runtime Variables (additional)

| Variable       | Usage                           |
| -------------- | ------------------------------- |
| `CORS_ORIGIN`  | Comma-separated allowed origins (defaults to allow all) |
| `LOG_LEVEL`    | Numeric log level for consola   |
| `NODE_ENV`     | `production` / `development`    |

## Webhooks & Callbacks

### Incoming Webhooks

| Endpoint                  | Source | Events                        | Verification                |
| ------------------------- | ------ | ----------------------------- | --------------------------- |
| `POST /api/webhooks/stripe` | Stripe | `checkout.session.completed` | `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` |

**Webhook processing (`checkout.session.completed`):**
1. Verify signature using Stripe SDK
2. Extract `productId` from session metadata and `customerEmail`
3. Look up product in database
4. Create `Purchase` record with download token (UUID, 24h expiry)
5. Send confirmation email with download link

### Outbound Redirects

| Trigger           | URL Pattern                                          |
| ----------------- | ---------------------------------------------------- |
| Checkout success  | `{FRONTEND_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}` |
| Checkout cancel   | `{FRONTEND_URL}/p/{product.slug}`                    |
