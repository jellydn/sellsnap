# ARCHITECTURE.md - System Architecture

## Architecture Overview
SellSnap follows a **monorepo with microservices-style separation** pattern using pnpm workspaces. The application is built with a **layered architecture** approach.

```
┌─────────────────────────────────────────────────────┐
│                   Browser Layer                      │
│                    React SPA                         │
│              (Vite Dev Server)                       │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/JSON
                     ▼
┌─────────────────────────────────────────────────────┐
│                  API Gateway Layer                   │
│                   Fastify Server                     │
│  (Helmet, CORS, Rate Limiting, Auth Middleware)     │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│               Business Logic Layer                   │
│    (Auth, File Upload, Stripe, Email, Pagination)   │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│                  Data Access Layer                   │
│                   Prisma ORM                         │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              PostgreSQL Database                     │
│              (Docker Container)                      │
└─────────────────────────────────────────────────────┘
```

---

## Architectural Patterns

### 1. Monorepo with Workspaces
**Pattern**: pnpm workspaces for code sharing and unified dependency management

**Benefits**:
- Single source of truth for shared packages (`db`, `logger`)
- Unified CI/CD pipeline
- Easier dependency management with `workspace:*` protocol

**Implementation**: `pnpm-workspace.yaml` defines workspace patterns

---

### 2. Layered Architecture
**Pattern**: Clear separation between presentation, business logic, and data layers

**Layers**:
1. **Presentation**: React components in `apps/web/src/pages/`, `apps/web/src/components/`
2. **API**: Fastify routes in `apps/server/src/routes/`
3. **Business Logic**: Utilities in `apps/server/src/lib/`
4. **Data Access**: Prisma client in `packages/db/`

---

### 3. RESTful API Design
**Pattern**: Resource-oriented URLs with standard HTTP methods

**Base Path**: `/api/`

**Endpoints**:
- `GET /api/products` - List products (cursor pagination)
- `GET /api/products/:id` - Get product details
- `POST /api/checkout` - Create checkout session
- `POST /api/auth/*` - Authentication endpoints
- `POST /api/webhooks` - Stripe webhooks

---

### 4. Middleware Pipeline
**Pattern**: Request processing through middleware chain

**Order** (`apps/server/src/index.ts`):
1. Helmet (security headers)
2. CORS (cross-origin handling)
3. Rate Limiting (request throttling)
4. Auth Middleware (session validation)
5. Route Handler (business logic)

---

### 5. Repository Pattern (via Prisma)
**Pattern**: Prisma ORM abstracts database access

**Implementation**: `packages/db/src/index.ts` exports `db` instance

**Usage**:
```typescript
import { db } from "db";
const products = await db.product.findMany();
```

---

## Data Flow

### Authentication Flow
```
User → Login Form
  ↓ (POST /api/auth/sign-in)
Fastify Auth Route
  ↓
better-auth validates credentials
  ↓
Create session in database
  ↓
Set HTTP-only cookie
  ↓
Return user data
  ↓
Redirect to dashboard
```

### Product Purchase Flow
```
User → Click "Buy"
  ↓ (POST /api/checkout)
Server creates Stripe Checkout session
  ↓
Return checkout URL
  ↓
User completes payment on Stripe
  ↓
Stripe sends webhook
  ↓ (POST /api/webhooks)
Server verifies webhook signature
  ↓
Create order in database
  ↓
Send confirmation (future)
```

### File Download Flow
```
User → Request download
  ↓ (POST /api/files/download)
Server validates purchase
  ↓
Generate download token (UUID, 24h expiry)
  ↓
Return download URL with token
  ↓ (GET /api/files/:token)
Server validates token
  ↓
Stream file from disk
  ↓
Increment view count (in-memory batch)
  ↓
Return file to user
```

---

## Entry Points

### Frontend
**File**: `apps/web/src/main.tsx`

**Responsibilities**:
- React app initialization
- Router setup (React Router)
- Auth provider setup
- Root component mounting

### Backend
**File**: `apps/server/src/index.ts`

**Responsibilities**:
- Fastify server initialization
- Middleware registration
- Route registration
- Database connection
- Server startup (port 3000)

---

## State Management

### Client-Side State
**Pattern**: React hooks (local component state)

**Tools**:
- `useState` - Component state
- `useEffect` - Side effects
- Custom hooks - Reusable logic (`apps/web/src/lib/auth.ts`)

### Server-Side State
**Pattern**: Stateless API with database sessions

**Session Storage**: PostgreSQL via better-auth

**In-Memory State**:
- View count queue (batched DB updates every 10s)

---

## Security Architecture

### Authentication
- **Method**: Session-based (HTTP-only cookies)
- **Provider**: better-auth with Prisma adapter
- **Password Hashing**: bcrypt

### Authorization
- **Protected Routes**: Middleware checks session validity
- **Route Guards**: `apps/server/src/routes/auth.ts` middleware

### API Security
- **Rate Limiting**: 100 req/min (production), 1000 req/min (test)
- **CORS**: Configurable origins
- **Helmet**: Security headers
- **Webhook Verification**: Stripe signature validation

---

## Performance Considerations

### View Counting Optimization
**Pattern**: In-memory queue with batch writes

**Implementation**: `apps/server/src/routes/files.ts`
- Collect view counts in memory
- Batch write to database every 10 seconds
- Reduces DB write load

### Static File Serving
**Pattern**: Fastify static plugin serves pre-built frontend

**Production Mode**: Serves `apps/web/dist/` from `apps/server/`

---

## Scalability Patterns

### Current Architecture
- Single Fastify server instance
- PostgreSQL on Docker (local development)

### Production Considerations
- Horizontal scaling: Stateless API allows multiple instances
- Database: Managed PostgreSQL (RDS, Supabase, etc.)
- File storage: Move to cloud storage (S3, R2)
- Session storage: Consider Redis for distributed sessions

---

## Error Handling Strategy

### API Errors
**Pattern**: Consistent error response format

```typescript
{
  success: false,
  error: "Error message"
}
```

### Client Errors
**Pattern**: Try-catch with user feedback

**Implementation**: `apps/web/src/lib/api.ts`

---

## Abstractions

### Shared Packages
1. **`packages/db/`**: Prisma client singleton
2. **`packages/logger/`**: Logging utility (future enhancement)

### Route Organization
One file per domain:
- `auth.ts` - Authentication endpoints
- `products.ts` - Product CRUD
- `checkout.ts` - Stripe checkout
- `webhooks.ts` - Webhook handlers
- `files.ts` - File serving

---

## Deployment Architecture

### Development
```
Vite Dev Server (5173) ← → Fastify Server (3000) → PostgreSQL (5432)
```

### Production (Planned)
```
CDN/Static Host ← → Load Balancer → Fastify Instances → Managed PostgreSQL
                    (Multiple)                             + Redis Cache
```
