# Architecture

**Analysis Date:** 2026-03-05

## Pattern Overview

**Overall:** Client-Server Monorepo with Separate Frontend/Backend

**Key Characteristics:**
- Monorepo structure using pnpm workspaces
- Clear separation: web client (Vite + React) and API server (Fastify)
- Shared database package for Prisma schema and client
- Route-based code splitting via React Router
- Session-based authentication with better-auth

## Layers

**Presentation Layer (Web App):**
- Purpose: User interface and client-side routing
- Location: `apps/web/src/`
- Contains: React components, pages, hooks, API client
- Depends on: Server API (via `/api/proxy`), better-auth session
- Used by: End users in browsers

**API Layer (Server):**
- Purpose: RESTful API endpoints, business logic, authentication
- Location: `apps/server/src/`
- Contains: Fastify routes, controllers, webhook handlers
- Depends on: Database (Prisma), Stripe, better-auth
- Used by: Web app, Stripe webhooks

**Data Layer (Database):**
- Purpose: Data persistence and relationships
- Location: `packages/db/`
- Contains: Prisma schema, migrations, generated client
- Depends on: PostgreSQL database
- Used by: Server API, better-auth

## Data Flow

**Authentication Flow:**
1. User signs up/logs in via web app forms
2. better-auth client sends request to `/api/auth/*` endpoints
3. Server validates credentials, creates session in database
4. Session cookie stored in browser
5. Protected routes check session before rendering

**Purchase Flow:**
1. User views product → clicks purchase
2. Web app calls `/api/checkout/:productSlug`
3. Server creates Stripe checkout session, returns URL
4. User redirected to Stripe for payment
5. Stripe sends webhook to `/api/webhooks/stripe` on completion
6. Server creates purchase record, generates download token
7. User redirected to success page with download link

**API Proxy Pattern:**
1. Web app fetches from `/api/proxy/*` routes
2. Vite dev server proxies to `localhost:3000`
3. Server handles actual API logic
4. Response returned via proxy

**State Management:**
- Server state: React Query (`@tanstack/react-query`) for caching
- Client state: React useState/useReducer
- Session state: better-auth with cookie-based sessions

## Key Abstractions

**API Client Pattern:**
- Purpose: Centralized HTTP communication layer
- Examples: `apps/web/src/lib/api.ts`
- Pattern: Named exports for each API endpoint, uses fetch() with session handling

**Protected Routes:**
- Purpose: Route-level authentication checks
- Examples: `apps/web/src/components/ProtectedRoute.tsx`, loader functions in App.tsx
- Pattern: Check `auth.session` presence, redirect to `/sign-in` if missing

**Database Models:**
- Purpose: Core data entities and relationships
- Examples: `User`, `Product`, `Purchase` (defined in `packages/db/prisma/schema.prisma`)
- Pattern: Prisma schema with relations (User→Products, Product→Purchases)

## Entry Points

**Web App Entry:**
- Location: `apps/web/src/main.tsx`
- Triggers: Browser loads the app
- Responsibilities: Renders `<App>` with React Router, mounts to DOM

**Server Entry:**
- Location: `apps/server/src/index.ts`
- Triggers: Server process starts
- Responsibilities: Registers Fastify plugins, routes, starts HTTP server on port 3000

**Database Entry:**
- Location: `packages/db/src/index.ts`
- Triggers: Imported by server or run via `prisma generate`
- Responsibilities: Exports Prisma client singleton

## Error Handling

**Strategy:** Try/catch with error state storage

**Patterns:**
- Server: Fastify error handling with HTTP status codes
- Client: try/catch blocks with `setError()` state updates
- API: Returns error responses as JSON with `error` property

## Cross-Cutting Concerns

**Logging:** Console.log only (no structured logging)

**Validation:** Manual validation in route handlers (no validation library)

**Authentication:** better-auth middleware for protected routes, session checks in loaders

**File Uploads:** Multipart form data handling via `@fastify/multipart`

---

*Architecture analysis: 2026-03-05*
