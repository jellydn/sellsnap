# STRUCTURE.md - Directory Structure

## Root Layout

```
sellsnap/
├── apps/                    # Applications
│   ├── web/                # React frontend
│   └── server/             # Fastify API server
├── packages/               # Shared packages
│   ├── db/                # Prisma client
│   └── logger/            # Logging utility
├── e2e/                   # Playwright E2E tests
├── docs/                  # Documentation
├── scripts/               # Automation scripts
├── .github/               # GitHub workflows
├── .planning/             # Planning documents
├── pnpm-workspace.yaml   # Workspace config
├── justfile             # Task runner commands
├── docker-compose.yml   # Local PostgreSQL
└── .env.example         # Environment template
```

---

## Frontend Structure (`apps/web/`)

```
apps/web/
├── public/                  # Static assets
│   └── vite.svg
├── src/
│   ├── components/          # Reusable components
│   │   ├── AppLayout.tsx      # Main layout wrapper
│   │   └── ProtectedRoute.tsx # Auth guard component
│   ├── lib/                # Utilities & client libs
│   │   ├── api.ts            # API client wrapper
│   │   ├── auth.ts           # Auth utilities
│   │   └── format.ts         # Formatting helpers
│   ├── pages/              # Route pages
│   │   ├── Dashboard.tsx     # User dashboard
│   │   ├── ProductPage.tsx   # Product detail page
│   │   └── NotFound.tsx      # 404 page
│   ├── types/              # TypeScript types
│   │   └── index.ts
│   ├── main.tsx            # App entry point
│   └── index.css           # Global styles + Tailwind
├── index.html              # HTML template
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript config
└── package.json           # Dependencies
```

**Key Locations**:
- Entry point: `src/main.tsx`
- Route definitions: React Router in `src/main.tsx`
- API client: `src/lib/api.ts`
- Auth client: `src/lib/auth.ts`

---

## Backend Structure (`apps/server/`)

```
apps/server/
├── prisma/                  # Prisma files
│   ├── schema.prisma        # Database schema
│   └── migrations/          # Migration files
├── public/                  # Static files
│   └── uploads/            # User uploads
├── src/
│   ├── routes/             # API endpoints
│   │   ├── auth.ts          # Auth endpoints (register, login, logout)
│   │   ├── products.ts      # Product CRUD
│   │   ├── checkout.ts      # Stripe checkout
│   │   ├── webhooks.ts      # Stripe webhooks
│   │   └── files.ts         # File serving & downloads
│   ├── lib/                # Business logic
│   │   ├── auth.ts          # better-auth config
│   │   ├── upload.ts        # File upload handling
│   │   ├── stripe.ts        # Stripe client
│   │   ├── email.ts         # Email utilities (future)
│   │   └── pagination.ts    # Cursor pagination helpers
│   └── index.ts            # Server entry point
├── __tests__/              # Test files
├── tsconfig.json
└── package.json
```

**Key Locations**:
- Entry point: `src/index.ts`
- Database schema: `prisma/schema.prisma`
- API routes: `src/routes/`
- Business logic: `src/lib/`

---

## Shared Packages (`packages/`)

```
packages/
├── db/                     # Prisma client (shared)
│   └── src/
│       └── index.ts        # Exports `db` instance
├── logger/                 # Logging utility (shared)
    └── src/
        └── index.ts        # Logger implementation
```

**Usage Pattern**:
```typescript
import { db } from "db";
import { logger } from "logger";
```

---

## E2E Tests Structure (`e2e/`)

```
e2e/
├── tests/
│   ├── auth.spec.ts       # Authentication tests
│   ├── products.spec.ts   # Product browsing tests
│   ├── checkout.spec.ts   # Purchase flow tests
│   └── files.spec.ts      # Download flow tests
├── playwright.config.ts   # Playwright configuration
└── package.json
```

**Coverage**: 10 test files covering critical user flows

---

## Configuration Files

### Root Level
- `pnpm-workspace.yaml` - Workspace configuration
- `justfile` - Task runner shortcuts
- `docker-compose.yml` - Local PostgreSQL
- `.env.example` - Environment template
- `biome.json` - Linting/formatting rules
- `tsconfig.base.json` - Base TypeScript config

### App Specific
- `apps/web/vite.config.ts` - Vite config
- `apps/web/tsconfig.json` - Web TypeScript config
- `apps/server/tsconfig.json` - Server TypeScript config

---

## Documentation (`docs/`)

```
docs/
├── prd.json              # Product requirements (Ralph format)
└── architecture.md       # Architecture docs (if present)
```

---

## Naming Conventions

### Files
- **Components**: `PascalCase.tsx` (e.g., `AppLayout.tsx`)
- **Utilities**: `camelCase.ts` (e.g., `format.ts`, `api.ts`)
- **Routes**: `camelCase.ts` (e.g., `auth.ts`, `products.ts`)
- **Tests**: `*.spec.ts` (Vitest), `*.spec.ts` (Playwright)
- **Types**: `camelCase.ts` or `index.ts`

### Folders
- **kebab-case**: `__tests__`, `e2e/`, `uploads/`
- **camelCase**: `components/`, `pages/`, `routes/`, `lib/`

### Database
- **Tables**: `PascalCase` (e.g., `User`, `Product`, `Order`)
- **Fields**: `camelCase` (e.g., `createdAt`, `stripePriceId`)

---

## Path Aliases

### Web App (`@/`)
**Config**: `apps/web/tsconfig.json`
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Usage**:
```typescript
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
```

---

## Key File Locations Reference

| Purpose | Location |
|---------|----------|
| React entry point | `apps/web/src/main.tsx` |
| Server entry point | `apps/server/src/index.ts` |
| Database schema | `apps/server/prisma/schema.prisma` |
| Auth configuration | `apps/server/src/lib/auth.ts` |
| API client | `apps/web/src/lib/api.ts` |
| Stripe integration | `apps/server/src/lib/stripe.ts` |
| File uploads | `apps/server/src/lib/upload.ts` |
| Environment template | `.env.example` |
| Task commands | `justfile` |
| CI workflow | `.github/workflows/ci.yml` |

---

## File Count Summary

| Location | Files |
|----------|-------|
| `apps/web/` | ~28 files |
| `apps/server/` | ~28 files |
| `packages/db/` | 6 files |
| `packages/logger/` | 1 file |
| `e2e/tests/` | 10 test files |

---

## Test File Organization

**Pattern**: Tests mirror source structure in `__tests__/` folders

```
apps/server/src/
├── routes/
│   ├── auth.ts
│   └── __tests__/
│       └── auth.test.ts
├── lib/
│   ├── upload.ts
│   └── __tests__/
│       └── upload.test.ts
```

**E2E Tests**: Separate in `e2e/tests/` directory
