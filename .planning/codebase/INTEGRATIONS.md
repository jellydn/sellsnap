# INTEGRATIONS.md - External Integrations

## Overview
SellSnap integrates with several external services for authentication, payments, file handling, and infrastructure.

---

## Payment Processing

### Stripe
**Purpose**: Handle checkout sessions and payment webhooks

**Configuration**:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Integration Points**:
- `apps/server/src/lib/stripe.ts` - Stripe client initialization
- `apps/server/src/routes/checkout.ts` - Checkout session creation
- `apps/server/src/routes/webhooks.ts` - Stripe webhook handler

**Features**:
- Checkout sessions for product purchases
- Webhook signature verification
- Order fulfillment on successful payment

**Environment**: Test mode (`sk_test_`) for development

---

## Authentication

### better-auth
**Purpose**: User authentication and session management

**Configuration**:
```bash
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=...
```

**Integration Points**:
- `apps/server/src/lib/auth.ts` - Auth configuration
- `apps/server/src/routes/auth.ts` - Auth endpoints
- `apps/web/src/lib/auth.ts` - Auth client utilities

**Features**:
- Email/password authentication
- Server-side session management
- Prisma adapter for database sessions
- Protected routes middleware

**Flow**:
1. User registers/logs in via `/api/auth/*` endpoints
2. better-auth creates session in database
3. Session token stored in HTTP-only cookie
4. Subsequent requests validated via middleware

---

## Database

### PostgreSQL (via Docker)
**Purpose**: Persistent data storage

**Configuration**:
```bash
DATABASE_URL=postgresql://sellsnap:sellsnap@localhost:5432/sellsnap
```

**Local Setup**:
```bash
docker-compose up -d  # Start PostgreSQL
```

**Connection Details**:
- Host: localhost
- Port: 5432
- User: sellsnap
- Password: sellsnap
- Database: sellsnap

**ORM**: Prisma 6
- Schema: `apps/server/prisma/schema.prisma`
- Migrations: `apps/server/prisma/migrations/`
- Shared client: `packages/db/src/index.ts`

---

## File Storage

### Local File System
**Purpose**: Store uploaded files and product assets

**Integration Points**:
- `apps/server/src/lib/upload.ts` - File upload handling
- `apps/server/src/routes/files.ts` - File serving endpoints
- `apps/server/public/uploads/` - Upload directory

**Features**:
- Multipart file upload via `@fastify/multipart`
- File validation (type, size limits)
- Download tokens (UUID, 24h expiration)
- View counting with in-memory batching

**Storage Path**: `apps/server/public/uploads/`

---

## Infrastructure

### GitHub Actions
**Purpose**: CI/CD automation

**Workflow**: `.github/workflows/ci.yml`

**Checks on Push**:
- Type checking (all packages)
- Linting (Biome)
- Unit tests (Vitest)
- E2E tests (Playwright)

**Triggers**: Push to any branch, Pull requests

---

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Application URLs
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
API_URL=http://localhost:3000

# Optional
LOG_LEVEL=info
```

**Setup**: Copy from `.env.example`

---

## CORS Configuration

**Allowed Origins**:
- Development: `http://localhost:5173` (Vite dev server)
- Configured via `CORS_ORIGIN` env var

**Implementation**: `@fastify/cors` middleware in `apps/server/src/index.ts`

---

## Security Middleware

### Implemented via Fastify plugins:
- **@fastify/helmet**: Security headers
- **@fastify/rate-limit**: Rate limiting (100 req/min production, 1000 req/min test)
- **@fastify/cors**: CORS protection

---

## Email Services

### Planned/Placeholder
**Note**: Email functionality is referenced but not fully implemented in current codebase. Areas marked for future email integration:
- Password reset flows
- Purchase confirmations
- Download notifications

---

## Future Integrations (Potential)

Based on codebase analysis, these services may be added:
- Email provider (SendGrid, Resend, AWS SES)
- File storage service (AWS S3, Cloudflare R2) for production
- Analytics/monitoring service
- Production payment processing (Stripe live mode)

---

## Webhook Handlers

### Stripe Webhooks
**Endpoint**: `POST /api/webhooks`

**Events Handled**:
- `checkout.session.completed` - Order fulfillment

**Verification**: Stripe signature verification using `STRIPE_WEBHOOK_SECRET`

---

## API Client Integration

### Frontend → Backend
**Base URL**: Configured via `API_URL` env var (default: `http://localhost:3000`)

**Implementation**: `apps/web/src/lib/api.ts`

**Pattern**:
```typescript
const api = {
  get: (url) => fetch(`${API_URL}${url}`, ...),
  post: (url, data) => fetch(`${API_URL}${url}`, ...),
  // ...
}
```
