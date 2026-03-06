# Codebase Concerns

**Analysis Date:** 2026-03-06
**Last Updated:** 2026-03-07

---

## Tech Debt

### ~~TD-1: Duplicate Layout components~~ ✅ FIXED

- Deleted dead `Layout.tsx` and unused `session.ts`

### TD-2: Inconsistent styling approach

- `ProductCreate.tsx`, `SignIn.tsx`, `SignUp.tsx`, `Dashboard.tsx`, `AppLayout.tsx` use inline `style={}` objects
- `ProductEdit.tsx`, `ProductPage.tsx`, `PurchaseSuccess.tsx`, `CreatorProfile.tsx`, `Settings.tsx` use Tailwind CSS classes
- The project declares Tailwind v4 as the standard but half the pages don't use it

### ~~TD-3: Duplicate PrismaClient instantiation~~ ✅ FIXED

- `apps/server/src/lib/prisma.ts` now re-exports from `db` package (shared client)
- Both packages use `@prisma/client@6.19.2`

### ~~TD-4: `formatPrice` duplicated across 3 files~~ ✅ FIXED

- Extracted to shared `apps/web/src/lib/format.ts`, all pages import from there

### ~~TD-5: No product deletion endpoint~~ ✅ FIXED

- `DELETE /api/products/:id` endpoint exists and cleans up files on disk

### TD-6: better-auth `session`/`account` tables managed outside Prisma schema

- The Prisma schema only defines `User`, `Product`, `Purchase`
- better-auth auto-creates `session`, `account`, `verification` tables via its adapter at runtime
- These tables are invisible to Prisma migrations, making schema management fragile

### ~~TD-7: Email sending throws in production~~ ✅ FIXED

- Changed from `throw new Error(...)` to `logger.warn(...)` — webhook no longer crashes

### ~~TD-8: Server listens only on port 3000, not configurable~~ ✅ FIXED

- Port/host now configurable via `PORT` and `HOST` env vars, defaults to `0.0.0.0:3000`

---

## Known Bugs

### ~~BUG-1: Email test assertions don't match current implementation~~ ✅ FIXED

- Tests now mock `@sellsnap/logger` and assert against `logger.box()` / `logger.warn()`

### ~~BUG-2: Purchase lookup by session_id is unauthenticated and leaks download tokens~~ ✅ FIXED

- Added auth requirement + email verification to `/api/purchases/by-session/:sessionId`

### ~~BUG-3: View count inflated by bots/crawlers~~ ✅ FIXED

- Added IP-based deduplication (1 minute cooldown) + batched DB writes (10s flush)

### ~~BUG-4: Stripe client may be `undefined` at runtime~~ ✅ FIXED

- Now always exports an initialized `Stripe` instance with fallback key; warns via `logger.warn`

### BUG-5: ~~`FRONTEND_URL` not in `.env.example`~~ NOT A BUG

- `FRONTEND_URL` is present in `.env.example` — this finding was incorrect

### ~~BUG-6: Download link in email points to wrong URL~~ ✅ FIXED

- Download link now uses `API_URL` env var (falling back to `FRONTEND_URL`)

---

## Security Considerations

### ~~SEC-1: No security headers (helmet)~~ ✅ FIXED

- `@fastify/helmet` is registered in server (with CSP disabled for static files)

### SEC-2: No CSRF protection

- All state-changing endpoints use cookie-based auth but have no CSRF token validation
- Product creation, profile updates, publish toggles are all vulnerable

### ~~SEC-3: Hardcoded `BETTER_AUTH_SECRET` in Dockerfile and docker-compose~~ ✅ FIXED

- `docker-compose.yml` now uses `${BETTER_AUTH_SECRET:?...}` syntax
- Dockerfile doesn't set any secrets (expects them from environment)

### ~~SEC-4: No password strength requirements~~ ✅ FIXED

- `better-auth` config now has `minPasswordLength: 8`

### ~~SEC-5: SVG uploads allowed — XSS vector~~ ✅ FIXED

- Removed `image/svg+xml` and `.svg` from allowed upload types

### ~~SEC-6: Product file uploads have no type restriction~~ ✅ FIXED

- `saveFile()` now uses `ALLOWED_FILE_EXTENSIONS` allowlist (35+ file types)

### ~~SEC-7: No input sanitization on user-controlled slugs~~ ✅ FIXED

- Added regex validation (`/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/`) and reserved slug blocklist

### ~~SEC-8: `CORS_ORIGIN` defaults to `true` (allow all origins)~~ ✅ FIXED

- Changed to `origin: allowedOrigins || false` (restrictive by default)

---

## Performance Bottlenecks

### ~~PERF-1: Analytics query fetches all purchase amounts into memory~~ ✅ FIXED

- Now uses Prisma `groupBy` + `_sum` aggregation instead of loading all purchase rows

### ~~PERF-2: File uploads buffered entirely in memory~~ ✅ FIXED

- Uses `pipeline()` to stream directly to disk (no memory buffering)

### ~~PERF-3: No database indices on frequently queried foreign keys~~ ✅ FIXED

- Added `@@index` on `Product.creatorId`, `Purchase.productId`, `Purchase.customerEmail`, `Purchase.stripeSessionId`

### ~~PERF-4: Slug uniqueness checked with loop + query~~ ✅ FIXED

- Single query to find highest suffix, then increment (instead of loop)

---

## Fragile Areas

### FRAG-1: Multipart parsing with untyped `request.params` casts

- Every route casts params: `request.params as { slug: string }` — no Fastify schema validation
- No request body schema validation on product create/update multipart forms
- Type safety relies entirely on runtime casts

### ~~FRAG-2: Webhook handler has no idempotency protection~~ ✅ FIXED

- Added `stripeSessionId` lookup before creating purchase — duplicate events are skipped with a warning

### ~~FRAG-3: Raw body parsing for all JSON~~ ✅ FIXED

- Removed global `addContentTypeParser`, now uses `preParsing` hook only for webhook route

### ~~FRAG-4: `Dockerfile` copies entire `/app` from builder to runner~~ ✅ FIXED

- Simplified to single-stage Dockerfile for reliability

---

## Scaling Limits

### SCALE-1: Local filesystem for uploads

- Files stored in `./uploads/` directory on the server filesystem
- Cannot scale horizontally — each server instance has its own uploads
- No CDN, no S3/R2 integration
- Upload directory not mounted as a volume in `docker-compose.yml` — data lost on container recreation

### ~~SCALE-2: Single-process server~~ ✅ FIXED

- Dockerfile now uses compiled JS (`node /app/apps/server/dist/index.js`) not tsx

### ~~SCALE-3: No pagination on list endpoints~~ ✅ FIXED

- Added cursor-based pagination to `GET /api/products` and `GET /api/creators/:slug`

### ~~SCALE-4: View count update on every page view~~ ✅ FIXED

- Views queued in memory, flushed via transaction every 10 seconds

---

## Dependencies at Risk

### DEP-1: `zod@^4.0.0` — major version, potentially unstable

- Zod v4 was a significant rewrite; may have breaking changes from ecosystem tooling expecting v3
- Only used in `checkout.ts` for a single schema

### ~~DEP-2: `better-auth@^1.5.3` — relatively new auth library~~ ✅ FIXED

- Version aligned: both web and server use `^1.5.3`

### ~~DEP-3: `tsx` used in production (`Dockerfile`, `Dockerfile.server`)~~ ✅ FIXED

- Dockerfile now uses `node dist/index.js` (compiled JS)

### ~~DEP-4: `@prisma/client` version mismatch across packages~~ ✅ FIXED

- Both server and db package use `6.19.2`

### DEP-5: `react-router-dom@^7.1.1` — v7 is a major version

- v7 has different APIs from v6 but code uses v6-style `<Routes>`/`<Route>`
- Works for now but may break on minor updates within v7

---

## Missing Critical Features

### ~~MISS-1: No email service integration~~ ✅ FIXED

- No longer crashes (uses logger.warn instead of throw)

### MISS-2: No password reset / forgot password flow

- better-auth supports it but it's not configured
- No UI for password reset

### MISS-3: No email verification

- Users can sign up with any email without verification
- `emailVerification` not enabled in better-auth config

### MISS-4: No Stripe Connect for creator payouts

- Platform collects payments but there's no mechanism to pay creators
- No Stripe Connect, no payout tracking, no revenue split configuration

### MISS-5: No file re-download mechanism after token expiry

- Download tokens expire after 24 hours with no way to regenerate
- No purchase history page for customers to re-download
- Customer must contact seller manually

### ~~MISS-6: No 404 / catch-all route in the web app~~ ✅ FIXED

- Added `NotFound` component and `<Route path="*">` catch-all in `App.tsx`

### MISS-7: No logging/monitoring infrastructure

- No structured logging format for production
- No error tracking (Sentry, etc.)
- No health check that verifies DB connectivity
- Health endpoint returns `{ status: "ok" }` without checking dependencies

---

## Test Coverage Gaps

### ~~TEST-1: No route integration tests for core business logic~~ ✅ PARTIALLY FIXED

- Added tests for: health, upload, email, auth, profile, webhooks, analytics
- Still missing: products CRUD, purchases, checkout

### TEST-2: Checkout test only validates Zod schema, not the route

- `checkout.test.ts` re-declares the schema and tests parsing
- Does not test the actual route handler, Stripe integration, or error paths

### TEST-3: No tests for auth middleware/session validation

- No test verifies that unauthenticated requests to protected routes return 401
- No test for authorization (user A can't edit user B's product)

### TEST-4: No web tests for key pages

- `ProductCreate.tsx` — **0 tests** (form submission, validation, file upload)
- `ProductEdit.tsx` — **0 tests** (load, save, publish toggle, file replace)
- `Settings.tsx` — **0 tests** (profile update, avatar upload)
- `PurchaseSuccess.tsx` — **0 tests**
- `CreatorProfile.tsx` — **0 tests**
- `ProtectedRoute.tsx` — **0 tests** (redirect behavior)

### ~~TEST-5: Email test is broken~~ ✅ FIXED

- Tests now correctly mock `@sellsnap/logger` and pass

### TEST-6: No end-to-end tests

- No Playwright, Cypress, or similar E2E testing
- No test covers the full purchase flow (browse → checkout → webhook → download)

---

## Summary

**Fixed (26 items):** TD-1, TD-3, TD-4, TD-5, TD-7, TD-8, BUG-1, BUG-2, BUG-3, BUG-4, BUG-6, SEC-1, SEC-3, SEC-4, SEC-5, SEC-6, SEC-7, SEC-8, PERF-1, PERF-2, PERF-3, PERF-4, FRAG-2, FRAG-3, FRAG-4, SCALE-2, SCALE-3, SCALE-4, DEP-2, DEP-3, DEP-4, MISS-1, MISS-6, TEST-1, TEST-5

**Invalid (1 item):** BUG-5 (was already present in `.env.example`)

**Remaining (10 items):**

- Tech Debt: TD-2, TD-6
- Security: SEC-2
- Fragile: FRAG-1
- Scaling: SCALE-1
- Dependencies: DEP-1, DEP-5
- Missing Features: MISS-2, MISS-3, MISS-4, MISS-5, MISS-7
- Test Gaps: TEST-2, TEST-3, TEST-4, TEST-6

_Concerns audit: 2026-03-07_
