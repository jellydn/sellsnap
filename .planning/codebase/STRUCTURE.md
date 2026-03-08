# Codebase Structure

**Analysis Date:** 2026-03-06

## Directory Layout

```
sellsnap/
├── apps/
│   ├── server/                    # Fastify API server
│   │   └── src/
│   │       ├── lib/               # Shared service modules
│   │       │   ├── __tests__/     # Unit tests for lib modules
│   │       │   ├── auth.ts        # better-auth config + header helper
│   │       │   ├── email.ts       # Email stub (dev: console, prod: throws)
│   │       │   ├── prisma.ts      # PrismaClient singleton
│   │       │   ├── stripe.ts      # Stripe client singleton
│   │       │   └── upload.ts      # File/image save + validation
│   │       ├── routes/            # Route modules (Fastify plugins)
│   │       │   ├── __tests__/     # Route integration tests
│   │       │   ├── analytics.ts   # GET /api/analytics
│   │       │   ├── auth.ts        # GET|POST /api/auth/*
│   │       │   ├── checkout.ts    # POST /api/checkout/:productSlug
│   │       │   ├── creators.ts    # GET /api/creators/:slug
│   │       │   ├── health.ts      # GET /api/health
│   │       │   ├── products.ts    # CRUD /api/products
│   │       │   ├── profile.ts     # GET|PUT /api/profile
│   │       │   ├── purchases.ts   # GET /api/purchases/..., /api/download/:token
│   │       │   └── webhooks.ts    # POST /api/webhooks/stripe
│   │       └── index.ts           # Entry point (~79 lines)
│   └── web/                       # React SPA (Vite)
│       └── src/
│           ├── components/        # Shared UI components
│           │   ├── __tests__/     # Component tests
│           │   ├── AppLayout.tsx   # Main layout (header, nav, auth state)
│           │   ├── Layout.tsx      # Alternate layout (unused in App.tsx)
│           │   └── ProtectedRoute.tsx  # Auth guard wrapper
│           ├── lib/               # Client utilities
│           │   ├── api.ts         # Typed fetch wrappers for /api endpoints
│           │   ├── auth.ts        # better-auth React client
│           │   └── session.ts     # useSession hook, signOut helper
│           ├── pages/             # Route-level page components
│           │   ├── __tests__/     # Page tests
│           │   ├── CreatorProfile.tsx
│           │   ├── Dashboard.tsx
│           │   ├── ProductCreate.tsx
│           │   ├── ProductEdit.tsx
│           │   ├── ProductPage.tsx
│           │   ├── PurchaseSuccess.tsx
│           │   ├── Settings.tsx
│           │   ├── SignIn.tsx
│           │   └── SignUp.tsx
│           ├── test/              # Test infrastructure
│           │   ├── setup.ts       # Vitest setup
│           │   └── test-utils.tsx # Custom render helpers
│           ├── App.tsx            # Route definitions
│           ├── main.tsx           # React DOM entry
│           ├── index.css          # Global styles (Tailwind)
│           └── vite-env.d.ts      # Vite type declarations
├── packages/
│   ├── db/                        # Prisma schema package
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # 3 models: User, Product, Purchase
│   │   │   └── migrations/        # SQL migrations
│   │   └── src/index.ts           # PrismaClient export (not used by server)
│   ├── logger/                    # @sellsnap/logger
│   │   └── src/index.ts           # consola wrapper with createLogger
│   └── tsconfig/                  # Shared TypeScript configs
├── scripts/
│   └── ralph/                     # Ralph automation scripts
├── .planning/
│   └── codebase/                  # Architecture documentation
├── justfile                       # Task runner commands
├── docker-compose.yml             # PostgreSQL + app containers
├── Dockerfile                     # Web app Docker build
├── Dockerfile.server              # Server Docker build
├── nginx.conf                     # Nginx reverse proxy config
└── package.json                   # Workspace root
```

## Directory Purposes

| Directory | Purpose |
|---|---|
| `apps/server/src/lib/` | Singleton service modules (database, auth, payments, file I/O, email) |
| `apps/server/src/routes/` | Domain-specific route modules, each a Fastify plugin function |
| `apps/web/src/components/` | Reusable React components (layouts, guards) |
| `apps/web/src/pages/` | Route-level page components (one per route) |
| `apps/web/src/lib/` | Client-side utilities (API client, auth client, session hooks) |
| `apps/web/src/test/` | Vitest setup and shared test utilities |
| `packages/db/` | Prisma schema, migrations, and client export |
| `packages/logger/` | Shared logging package (`@sellsnap/logger`) used by server |
| `packages/tsconfig/` | Shared TypeScript configuration |
| `scripts/ralph/` | Ralph automation agent scripts |
| `.planning/codebase/` | Architecture and structure documentation |

## Key File Locations

| What | File |
|---|---|
| Server entry point | `apps/server/src/index.ts` |
| Web entry point | `apps/web/src/main.tsx` |
| Route definitions (web) | `apps/web/src/App.tsx` |
| Prisma schema | `packages/db/prisma/schema.prisma` |
| Database client (server) | `apps/server/src/lib/prisma.ts` |
| Auth config (server) | `apps/server/src/lib/auth.ts` |
| Auth client (web) | `apps/web/src/lib/auth.ts` |
| API client functions | `apps/web/src/lib/api.ts` |
| Stripe client | `apps/server/src/lib/stripe.ts` |
| Stripe webhook handler | `apps/server/src/routes/webhooks.ts` |
| File upload logic | `apps/server/src/lib/upload.ts` |
| Vite config + proxy | `apps/web/vite.config.ts` |
| Environment vars template | `.env.example` |
| Task runner | `justfile` |
| Workspace config | `pnpm-workspace.yaml` |

## Naming Conventions

### Files

| Type | Convention | Example |
|---|---|---|
| React components | PascalCase `.tsx` | `Dashboard.tsx`, `AppLayout.tsx` |
| Route modules (server) | kebab-case `.ts` | `products.ts`, `webhooks.ts` |
| Lib modules (server) | kebab-case `.ts` | `prisma.ts`, `stripe.ts` |
| Lib modules (web) | kebab-case `.ts` | `api.ts`, `auth.ts`, `session.ts` |
| Test files | `{name}.test.ts(x)` in `__tests__/` | `upload.test.ts`, `Dashboard.test.tsx` |

### Exports

| Type | Convention | Example |
|---|---|---|
| React components | Named PascalCase function | `export function Dashboard()` |
| Route modules | Named async function | `export async function productRoutes(server)` |
| Lib singletons | Named const | `export const prisma`, `export const auth` |
| Utility functions | Named camelCase | `export function saveImage()`, `export function headersToHeaders()` |
| Web API functions | Named async camelCase | `export async function fetchProducts()` |

### Routes (API)

- All prefixed with `/api/`
- Resource-oriented: `/api/products`, `/api/creators/:slug`, `/api/profile`
- Nested actions: `/api/products/:id/publish`, `/api/checkout/:productSlug`
- Special: `/api/auth/*` (catch-all for better-auth), `/api/webhooks/stripe`

## Where to Add New Code

| Task | Location | Pattern |
|---|---|---|
| New API domain | `apps/server/src/routes/{domain}.ts` | Export `async function {domain}Routes(server: FastifyInstance)`, register in `index.ts` |
| New shared service | `apps/server/src/lib/{service}.ts` | Export singleton or functions, import in routes |
| New page | `apps/web/src/pages/{PageName}.tsx` | PascalCase component, add `<Route>` in `App.tsx` |
| New shared component | `apps/web/src/components/{Name}.tsx` | Named export function component |
| New API client function | `apps/web/src/lib/api.ts` | Add typed async function with fetch + error handling |
| New Prisma model | `packages/db/prisma/schema.prisma` | Add model, run `just prisma-migrate {name}` |
| Server unit test | `apps/server/src/{lib,routes}/__tests__/{name}.test.ts` | Vitest |
| Web component test | `apps/web/src/{pages,components}/__tests__/{Name}.test.tsx` | Vitest + @testing-library/react |

## Special Directories

### `uploads/` (gitignored, runtime)

Created at server startup by `ensureUploadDirs()`. Contains:
- `images/` — cover images served via `@fastify/static` at `/uploads/images/`
- `files/` — digital product files served via streaming download endpoint

### `packages/db/prisma/migrations/`

Prisma migration history. Managed via `just prisma-migrate {name}`.

### `apps/web/src/test/`

Vitest infrastructure:
- `setup.ts` — global test setup (e.g., jest-dom matchers)
- `test-utils.tsx` — custom render with providers (BrowserRouter, etc.)

### `.planning/codebase/`

Architecture documentation (this file and ARCHITECTURE.md). Not part of the build.
