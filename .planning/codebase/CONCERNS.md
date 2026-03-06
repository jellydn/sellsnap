# Codebase Concerns

**Analysis Date:** 2026-03-06

---

## Tech Debt

### TD-1: Duplicate Layout components
- `AppLayout.tsx` is actively used; `Layout.tsx` is dead code with similar functionality
- Both implement the same header/nav pattern differently

### TD-2: Inconsistent styling approach
- `ProductCreate.tsx`, `SignIn.tsx`, `SignUp.tsx`, `Dashboard.tsx`, `AppLayout.tsx` use inline `style={}` objects
- `ProductEdit.tsx`, `ProductPage.tsx`, `PurchaseSuccess.tsx`, `CreatorProfile.tsx`, `Settings.tsx` use Tailwind CSS classes
- The project declares Tailwind v4 as the standard but half the pages don't use it

### TD-3: Duplicate PrismaClient instantiation
- `packages/db/src/index.ts` exports a `prisma` instance (intended shared client)
- `apps/server/src/lib/prisma.ts` creates its own separate `PrismaClient` instance, ignoring the `db` package
- Two Prisma versions: `@prisma/client@6.19.2` in server, `@prisma/client@^6.2.1` in db package

### TD-4: `formatPrice` duplicated across 3 files
- Defined locally in `Dashboard.tsx`, `ProductPage.tsx`, and `CreatorProfile.tsx`
- Should be a shared utility

### TD-5: No product deletion endpoint
- Products can only be created, updated, and toggled published — there is no `DELETE /api/products/:id` route
- Uploaded files (images + product files) are never cleaned up when products are updated with new files

### TD-6: better-auth `session`/`account` tables managed outside Prisma schema
- The Prisma schema only defines `User`, `Product`, `Purchase`
- better-auth auto-creates `session`, `account`, `verification` tables via its adapter at runtime
- These tables are invisible to Prisma migrations, making schema management fragile

### TD-7: Email sending throws in production
- `lib/email.ts` explicitly `throw new Error(...)` when `NODE_ENV === "production"`
- The Stripe webhook handler calls `sendEmail()` — a production purchase will crash after creating the purchase record
- **This is a blocking production issue**, not just tech debt

### TD-8: Server listens only on port 3000, not configurable
- `server.listen({ port: 3000 })` is hardcoded with no `PORT` env var or `host: '0.0.0.0'` binding
- Docker container will fail to accept external connections without `host: '0.0.0.0'`

---

## Known Bugs

### BUG-1: Email test assertions don't match current implementation
- `email.test.ts` asserts `console.log("=== EMAIL ===")` but the implementation uses `logger.box()`
- These tests likely fail or were written against a previous version

### BUG-2: Purchase lookup by session_id is unauthenticated and leaks download tokens
- `GET /api/purchases/by-session/:sessionId` requires no authentication
- Anyone who knows/guesses a Stripe session ID can obtain the `downloadToken` for the purchase
- The Stripe session ID is visible in the URL after checkout redirect

### BUG-3: View count inflated by bots/crawlers
- `GET /api/products/by-slug/:slug` unconditionally increments `viewCount` on every request
- No protection against bots, crawlers, or duplicate counts from the same visitor
- Rate limited at 60/min but that still allows significant inflation

### BUG-4: Stripe client may be `undefined` at runtime
- `lib/stripe.ts` conditionally assigns `stripe` only when `STRIPE_SECRET_KEY` is set
- If not set, `stripe` is exported as `undefined` but checkout and webhook routes use it without null checks
- This will crash at runtime with a cryptic error rather than a clear startup failure

### BUG-5: `FRONTEND_URL` not in `.env.example`
- Both checkout and webhook routes reference `process.env.FRONTEND_URL` for redirect URLs
- Missing from `.env.example`, easy for new devs to miss

### BUG-6: Download link in email points to wrong URL
- Webhook sends `${process.env.FRONTEND_URL}/api/download/${downloadToken}` — this routes through the frontend
- The download endpoint is on the server (`/api/download/:token`), which in production sits behind nginx on a different origin
- In docker-compose, API calls need to go through the server, not the frontend

---

## Security Considerations

### SEC-1: No security headers (helmet)
- No `@fastify/helmet` or equivalent — missing `X-Frame-Options`, `X-Content-Type-Options`, CSP, etc.
- Static files served without security headers

### SEC-2: No CSRF protection
- All state-changing endpoints use cookie-based auth but have no CSRF token validation
- Product creation, profile updates, publish toggles are all vulnerable

### SEC-3: Hardcoded `BETTER_AUTH_SECRET` in Dockerfile and docker-compose
- `Dockerfile` line 28: `ENV BETTER_AUTH_SECRET=dev-secret-change-in-production-minimum-32-chars`
- `docker-compose.yml` line 14: same hardcoded value
- These get baked into images and committed to version control

### SEC-4: No password strength requirements
- `better-auth` config has `emailAndPassword: { enabled: true }` with no `minPasswordLength` or complexity rules
- Users can register with trivially weak passwords

### SEC-5: SVG uploads allowed — XSS vector
- `image/svg+xml` and `.svg` are in the allowed image upload list
- SVGs can contain `<script>` tags and event handlers
- Served via `@fastify/static` without `Content-Security-Policy` or `Content-Disposition: attachment`
- A malicious SVG cover image could execute JS in the context of the domain

### SEC-6: Product file uploads have no type restriction
- `saveFile()` accepts any file type — executables, scripts, HTML files
- While these are served as downloads (not rendered), the lack of allowlist is risky

### SEC-7: No input sanitization on user-controlled slugs
- Profile slug (`PUT /api/profile`) accepts any string value
- No regex validation, length limits, or reserved word checks
- Could create slugs that conflict with routes (e.g., `api`, `sign-in`, `dashboard`)

### SEC-8: `CORS_ORIGIN` defaults to `true` (allow all origins)
- `origin: allowedOrigins || true` — if env var is unset, any origin can make credentialed requests
- Should default to a restrictive value in production

---

## Performance Bottlenecks

### PERF-1: Analytics query fetches all purchase amounts into memory
- `analyticsRoutes` loads every purchase row for the user with `include: { purchases: { select: { amount: true } } }`
- Revenue is calculated in JS via `.reduce()` instead of using `_sum` aggregation in Prisma
- Will degrade with increasing purchase volume

### PERF-2: File uploads buffered entirely in memory
- `saveImage()` and `saveFile()` both collect all chunks into `buffers[]` then `Buffer.concat()`
- With 10MB upload limit, a burst of concurrent uploads could consume significant memory
- Should stream to disk directly

### PERF-3: No database indices on frequently queried foreign keys
- `Product.creatorId` has no explicit index (Prisma adds FK constraint but not always an index depending on provider)
- `Purchase.productId` has no explicit index
- `Purchase.customerEmail` has no index (used in lookup patterns)
- `Purchase.stripeSessionId` has no index or unique constraint (queried by `findFirst`)

### PERF-4: Slug uniqueness checked with loop + query
- Product creation does `while (findUnique)` loop to find available slug
- Each iteration is a separate DB round-trip
- P2002 fallback partially mitigates but the loop is still wasteful

---

## Fragile Areas

### FRAG-1: Multipart parsing with untyped `request.params` casts
- Every route casts params: `request.params as { slug: string }` — no Fastify schema validation
- No request body schema validation on product create/update multipart forms
- Type safety relies entirely on runtime casts

### FRAG-2: Webhook handler has no idempotency protection
- If Stripe retries a `checkout.session.completed` event, a duplicate `Purchase` record is created
- No check for existing purchase with the same `stripeSessionId` or `stripePaymentIntentId`
- Could result in duplicate emails and download tokens

### FRAG-3: Raw body parsing for all JSON
- Custom content type parser stores raw string as `request.body` for Stripe webhook signature verification
- This affects all JSON endpoints — body is a string, not parsed JSON
- Checkout route manually `JSON.parse(request.body as string)` to work around this

### FRAG-4: `Dockerfile` copies entire `/app` from builder to runner
- `COPY --from=builder /app /app` copies all source code, node_modules, and build artifacts
- Runner image is bloated with dev dependencies and source files
- `Dockerfile.server` does this more correctly but still copies more than needed

---

## Scaling Limits

### SCALE-1: Local filesystem for uploads
- Files stored in `./uploads/` directory on the server filesystem
- Cannot scale horizontally — each server instance has its own uploads
- No CDN, no S3/R2 integration
- Upload directory not mounted as a volume in `docker-compose.yml` — data lost on container recreation

### SCALE-2: Single-process server
- No clustering, no PM2, no worker threads
- Dockerfile uses `tsx` (dev transpiler) in production instead of compiled JS
- `Dockerfile.server` runs `npx tsx` instead of `node dist/index.js` despite having a build step

### SCALE-3: No pagination on list endpoints
- `GET /api/products` returns all products for a user
- `GET /api/analytics` loads all products with all purchases
- `GET /api/creators/:slug` returns all published products
- Will become slow as data grows

### SCALE-4: View count update on every page view
- `viewCount: { increment: 1 }` creates a write operation on every product page load
- Under high traffic, this creates write contention on the product row
- Should batch or use a separate counter table/Redis

---

## Dependencies at Risk

### DEP-1: `zod@^4.0.0` — major version, potentially unstable
- Zod v4 was a significant rewrite; may have breaking changes from ecosystem tooling expecting v3
- Only used in `checkout.ts` for a single schema

### DEP-2: `better-auth@^1.5.3` — relatively new auth library
- Less battle-tested than alternatives (passport, lucia, next-auth)
- Version mismatch: server uses `^1.5.3`, web pins `1.5.3` exactly
- Auto-manages database tables outside Prisma migrations

### DEP-3: `tsx` used in production (`Dockerfile`, `Dockerfile.server`)
- `tsx` is a development tool for running TypeScript directly
- Not recommended for production — adds startup overhead and JIT compilation
- Server has a `build` script but Docker doesn't use the compiled output

### DEP-4: `@prisma/client` version mismatch across packages
- Server: `@prisma/client@6.19.2` (pinned)
- DB package: `@prisma/client@^6.2.1` (range)
- Could lead to incompatible generated clients

### DEP-5: `react-router-dom@^7.1.1` — v7 is a major version
- v7 has different APIs from v6 but code uses v6-style `<Routes>`/`<Route>`
- Works for now but may break on minor updates within v7

---

## Missing Critical Features

### MISS-1: No email service integration
- `sendEmail()` throws in production — purchases will fail to deliver download links
- No Resend, SendGrid, SES, or any email provider configured
- **Blocks production launch**

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

### MISS-6: No 404 / catch-all route in the web app
- `App.tsx` has no `<Route path="*">` fallback
- Navigating to unknown routes shows a blank page

### MISS-7: No logging/monitoring infrastructure
- No structured logging format for production
- No error tracking (Sentry, etc.)
- No health check that verifies DB connectivity
- Health endpoint returns `{ status: "ok" }` without checking dependencies

---

## Test Coverage Gaps

### TEST-1: No route integration tests for core business logic
- Products routes (CRUD, publish toggle) — **0 tests**
- Purchases/download routes — **0 tests**
- Webhooks — **0 tests**
- Profile routes — **0 tests**
- Analytics routes — **0 tests**
- Creators routes — **0 tests**
- Only health route has an integration test

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
- `PurchaseSuccess.tsx` — **0 tests** (while the component exists, no coverage)
- `CreatorProfile.tsx` — **0 tests**
- `ProtectedRoute.tsx` — **0 tests** (redirect behavior)

### TEST-5: Email test is broken
- Tests assert against `console.log` calls but implementation uses `consola` logger's `.box()` method
- Will fail when actually run

### TEST-6: No end-to-end tests
- No Playwright, Cypress, or similar E2E testing
- No test covers the full purchase flow (browse → checkout → webhook → download)
