# External Integrations

**Analysis Date:** 2026-03-05

## APIs & External Services

**Payment Processing:**
- Stripe - Payment handling and checkout
- SDK/Client: `stripe` v17.6.0
- Auth: `STRIPE_SECRET_KEY` env var
- Webhook: `STRIPE_WEBHOOK_SECRET` for signature verification

**Email:**
- Development: Console logging only (no email service integrated)
- Production: Not configured (logs to console via `console.log`)

## Data Storage

**Databases:**
- PostgreSQL (via Vercel Postgres or external)
- Connection: `DATABASE_URL` env var
- Client: Prisma ORM with `@prisma/client`

**File Storage:**
- Local filesystem (uploads stored in server filesystem)
- Note: No CDN configured for file delivery

**Caching:**
- None (server-side state via better-auth sessions)

## Authentication & Identity

**Auth Provider:**
- Custom (using better-auth library)
- Implementation: Email/password authentication with session management
- Session storage: PostgreSQL database via better-auth
- Password hashing: Built-in with better-auth

## Monitoring & Observability

**Error Tracking:**
- None configured

**Logs:**
- Console logging (development only)
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- Vercel (primary deployment platform)

**CI Pipeline:**
- None configured (manual deployment via Vercel)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signature verification
- `BETTER_AUTH_SECRET` - Secret for better-auth session signing
- `BETTER_AUTH_URL` - Base URL for auth callbacks

**Secrets location:**
- `.env` files (not committed to git)
- `.env.example` in `apps/server/` for reference

## Webhooks & Callbacks

**Incoming:**
- `/api/webhooks/stripe` - Stripe webhook handler for payment events
  - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
  - Signature verified using `STRIPE_WEBHOOK_SECRET`

**Outgoing:**
- Stripe Checkout API - Redirects users to Stripe-hosted checkout page
- Stripe API - Creates checkout sessions, retrieves payment data

---

*Integration audit: 2026-03-05*
