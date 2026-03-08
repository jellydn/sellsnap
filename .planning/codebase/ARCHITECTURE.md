# Architecture

**Analysis Date:** 2026-03-06

## Pattern Overview

SellSnap follows a **pnpm monorepo** architecture with a clear client–server split. The frontend is a React SPA (Vite) that communicates with a Fastify REST API server. All `/api` requests are proxied from the Vite dev server (port 5173) to Fastify (port 3000).

- **Architectural style:** Modular monolith — single deployable server, route-per-domain decomposition
- **Auth strategy:** better-auth with Prisma adapter (email/password), session-based via cookies
- **Payments:** Stripe Checkout (redirect-based) with webhook fulfillment
- **Database:** PostgreSQL via Prisma ORM
- **File storage:** Local filesystem (`uploads/images/`, `uploads/files/`)

## Layers

```
┌──────────────────────────────────────────────┐
│  Web (React SPA)                             │
│  ├── Pages (route-level components)          │
│  ├── Components (shared UI)                  │
│  └── Lib (auth client, API helpers, session) │
├──────────────────────────────────────────────┤
│  Vite Dev Proxy  /api → :3000               │
├──────────────────────────────────────────────┤
│  Server (Fastify)                            │
│  ├── Routes (9 domain modules)               │
│  └── Lib (prisma, auth, stripe, upload, email)│
├──────────────────────────────────────────────┤
│  Shared Packages                             │
│  ├── @sellsnap/logger (consola wrapper)      │
│  └── db (Prisma schema, not directly used)   │
├──────────────────────────────────────────────┤
│  PostgreSQL                                  │
│  Stripe (external)                           │
│  Local filesystem (uploads)                  │
└──────────────────────────────────────────────┘
```

### Server Layers

1. **Entry point** (`src/index.ts`, ~79 lines) — registers plugins (CORS, rate-limit, multipart, static) and mounts all route modules
2. **Route modules** (`src/routes/*.ts`) — each exports an `async function xRoutes(server: FastifyInstance)` that registers endpoints under `/api/`
3. **Lib modules** (`src/lib/*.ts`) — singleton services: `prisma`, `stripe`, `auth`, `upload`, `email`

### Web Layers

1. **Entry** (`main.tsx`) — React 19 + StrictMode + BrowserRouter
2. **App** (`App.tsx`) — route definitions with `ProtectedRoute` wrapper
3. **Pages** — full-page components (Dashboard, ProductCreate, ProductEdit, etc.)
4. **Components** — `AppLayout` (header/nav), `ProtectedRoute` (auth guard), `Layout` (alternate layout)
5. **Lib** — `auth.ts` (better-auth React client), `api.ts` (fetch wrappers), `session.ts` (useSession hook)

## Data Flow

### Product Purchase Flow

```
Browser → /p/:slug (ProductPage)
  → GET /api/products/by-slug/:slug (increments viewCount)
  → POST /api/checkout/:productSlug
    → Stripe Checkout Session created
    → Redirect to Stripe hosted payment page
  → Stripe webhook → POST /api/webhooks/stripe
    → checkout.session.completed event
    → Purchase record created with downloadToken (24h expiry)
    → Email sent with download link
  → /purchase/success?session_id=...
    → GET /api/purchases/by-session/:sessionId
  → GET /api/download/:token → streams file
```

### Authentication Flow

```
Browser → /sign-up or /sign-in
  → better-auth client → POST /api/auth/*
  → Fastify route converts to Web Request → auth.handler(req)
  → better-auth processes with Prisma adapter
  → Session cookie set on response
  → Subsequent requests: auth.api.getSession({ headers }) on server
  → Client: authClient.useSession() hook for session state
```

### Creator Product Management

```
Dashboard (authenticated)
  → GET /api/products (creator's products)
  → POST /api/products (multipart: title, description, price, coverImage, productFile)
    → saveImage() → /uploads/images/{uuid}.ext
    → saveFile() → uploads/files/{uuid}.ext
    → Prisma create with auto-slug generation
  → PUT /api/products/:id (update, ownership verified)
  → PATCH /api/products/:id/publish (toggle)
```

## Key Abstractions

### Route Module Pattern

Every route module follows this signature — no base class, just a function:

```typescript
export async function xRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/x", async (request, reply) => { ... });
}
```

### Auth Guard Pattern (Server)

Repeated in every authenticated route — inline session check, no middleware:

```typescript
const session = await auth.api.getSession({
  headers: headersToHeaders(request.headers as Record<string, string | string[] | undefined>),
});
if (!session?.user) {
  return reply.status(401).send({ error: "Unauthorized" });
}
```

### Auth Guard Pattern (Web)

`ProtectedRoute` component wraps dashboard routes, redirects to `/sign-in` if unauthenticated.

### API Client Pattern (Web)

`api.ts` exports typed async functions (e.g., `fetchProducts`, `createProduct`) that call `fetch()` against `/api` with `credentials: "include"`. No centralized HTTP client library — raw `fetch` with manual error handling.

### File Upload Pattern

Multipart parsing via `@fastify/multipart` — `request.parts()` async iterator separates fields from files. Files saved to local filesystem with UUID names.

## Entry Points

| Entry Point | Location | Purpose |
|---|---|---|
| Server start | `apps/server/src/index.ts` | Fastify bootstrap, plugin registration, route mounting |
| Web app | `apps/web/src/main.tsx` | React DOM render with BrowserRouter |
| Web routes | `apps/web/src/App.tsx` | React Router route definitions |
| Prisma schema | `packages/db/prisma/schema.prisma` | Database schema (User, Product, Purchase) |
| Stripe webhook | `apps/server/src/routes/webhooks.ts` | POST `/api/webhooks/stripe` |
| better-auth handler | `apps/server/src/routes/auth.ts` | Catch-all `/api/auth/*` |

## Error Handling

### Server

- **Route-level try/catch** — most routes rely on Fastify's default error handling
- **Explicit error responses** — `reply.status(4xx).send({ error: "message" })` with consistent `{ error: string }` shape
- **Webhook errors** — logged via `@sellsnap/logger`, returns appropriate HTTP status
- **Auth errors** — caught in auth route, returns `{ error, code: "AUTH_FAILURE" }`
- **Prisma unique constraint** (`P2002`) — handled in product creation with UUID slug fallback
- **No global error handler** — relies on Fastify's built-in error serialization

### Web

- **API calls** — try/catch with error message extraction from response JSON
- **Auth state** — `useSession()` hook returns `isPending`/`data`, no error boundary pattern
- **No global error boundary** configured

## Cross-Cutting Concerns

### Authentication

- **Server:** `better-auth` with `prismaAdapter`, email/password enabled. Session extracted per-request via `auth.api.getSession()`. No middleware — each route does its own check.
- **Web:** `createAuthClient()` from `better-auth/react`, `useSession()` hook, `ProtectedRoute` component.

### Rate Limiting

- **Global:** 100 req/min via `@fastify/rate-limit`
- **Per-route overrides:** product slug lookup (60/min), checkout (20/min), download (10/min)

### CORS

- Configured via `CORS_ORIGIN` env var (comma-separated), falls back to `true` (all origins)
- `credentials: true` enabled for cookie-based auth

### File Uploads

- `@fastify/multipart` with configurable `MAX_UPLOAD_SIZE` (default 10MB)
- Image validation: MIME type + extension whitelist
- Static file serving: `@fastify/static` for `/uploads/images/`
- Digital product files stored in `uploads/files/`, served via streaming download endpoint

### Logging

- `@sellsnap/logger` package wraps `consola` with configurable log level
- Fastify built-in logger also enabled (`logger: true`)

### Database

- 3 models: `User`, `Product`, `Purchase`
- Prices stored in cents (integer)
- Slugs unique on both User and Product
- Cascade deletes: User → Products → Purchases

### Email

- Stub implementation: logs to console in development, throws in production
- Used for purchase confirmation with download link

### Validation

- `zod` used in checkout route for body validation
- Most routes use manual field checking (no schema validation framework)
- Image files validated against MIME type and extension whitelists
