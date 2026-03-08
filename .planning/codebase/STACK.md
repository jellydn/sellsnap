# STACK.md - Technology Stack

## Project Overview
**SellSnap** - Monorepo for selling digital products with React + Fastify + Prisma + PostgreSQL.

---

## Core Technologies

### Frontend (`apps/web`)
- **Framework**: React 19
- **Build Tool**: Vite 6
- **Language**: TypeScript 5.7 (strict mode)
- **Routing**: React Router 7
- **Styling**: Tailwind CSS v4
- **State**: React hooks (useState, useEffect, custom hooks)
- **Testing**: Vitest + @testing-library/react

### Backend (`apps/server`)
- **Runtime**: Node.js 20+
- **Framework**: Fastify 5
- **Language**: TypeScript 5.7 (strict mode)
- **API Style**: RESTful JSON API
- **Testing**: Vitest

### Database
- **Database**: PostgreSQL
- **ORM**: Prisma 6
- **Migrations**: Prisma Migrate
- **Client**: Shared via `packages/db`

### Authentication
- **Library**: better-auth
- **Adapter**: Prisma
- **Session Management**: Server-side sessions

### Payments
- **Provider**: Stripe
- **Flow**: Checkout + Webhooks
- **Features**: Product checkout, webhook handling

---

## Package Manager & Monorepo

- **Package Manager**: pnpm
- **Monorepo**: pnpm workspaces
- **Workspace Protocol**: `workspace:*` for internal dependencies

### Workspace Structure
```
apps/
├── web/          # Frontend application
└── server/       # API server
packages/
├── db/           # Shared Prisma client
└── logger/       # Shared logging utility
```

---

## Development Tools

### Task Runner
- **just**: CLI for shortcuts (install, dev, typecheck, lint, build, test, e2e, prisma)

### Code Quality
- **Linter/Formatter**: Biome (lint + format)
- **TypeScript**: Strict mode enabled
- **Pre-commit Hooks**: prek (pre-commit hooks runner)

### Version Control
- **Git**: Version control
- **GitHub**: CI/CD via GitHub Actions

---

## TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext
- **Strict Mode**: Enabled
- **Path Aliases** (web): `@/*` → `apps/web/src/*`

---

## Environment & Configuration

### Required Environment Variables
```bash
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
API_URL=http://localhost:3000
```

### Local Development
- **Database**: Docker Compose (PostgreSQL on port 5432)
- **Credentials**: user `sellsnap`, password `sellsnap`, database `sellsnap`

---

## Build & Deployment

### Build Commands
```bash
just build-web      # Build React app for production
just typecheck      # Type check all packages
```

### Production Server
- Serves built frontend from `apps/web/dist/`
- Fastify serves static files via `@fastify/static`

---

## Key Dependencies by Category

### Frontend Core
- `react`, `react-dom`
- `react-router`
- `vite`

### Backend Core
- `fastify`
- `@fastify/cors`
- `@fastify/helmet`
- `@fastify/rate-limit`
- `@fastify/static`
- `@fastify/multipart`

### Database & Auth
- `@prisma/client`
- `better-auth`
- `bcrypt` (password hashing)

### Stripe & Payments
- `stripe`
- `@stripe/stripe-js`

### Utilities
- `zod` (schema validation)
- `nanoid` (ID generation)
- `date-fns` (date formatting)

### Testing
- `vitest`
- `@testing-library/react`
- `@testing-library/user-event`
- `@playwright/test`
- `jsdom`

---

## Version Summary

| Package | Version |
|---------|---------|
| React | 19 |
| Vite | 6 |
| Fastify | 5 |
| Prisma | 6 |
| TypeScript | 5.7 |
| Tailwind CSS | 4 |
| better-auth | latest |
| Stripe | latest |
