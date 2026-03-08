# Coding Conventions

**Analysis Date:** 2026-03-06

## Naming Patterns

| Category | Convention | Examples |
|---|---|---|
| Files (components/pages) | PascalCase `.tsx` | `AppLayout.tsx`, `Dashboard.tsx`, `ProtectedRoute.tsx` |
| Files (utilities/lib) | kebab-case `.ts` | `auth.ts`, `upload.ts`, `test-utils.tsx` |
| Files (routes) | kebab-case `.ts` | `health.ts`, `checkout.ts`, `webhooks.ts` |
| React components | PascalCase `function` declarations | `function Dashboard()`, `function AppLayout()` |
| Variables/functions | camelCase | `handleSignOut`, `fetchProducts`, `formatPrice` |
| Constants | camelCase or SCREAMING_SNAKE_CASE | `IMAGES_DIR`, `FILES_DIR`, `ALLOWED_IMAGE_MIME_TYPES` |
| Interfaces | PascalCase | `Product`, `CreateProductData`, `AnalyticsData` |
| Route plugins | camelCase with `Routes` suffix | `healthRoutes`, `productRoutes`, `checkoutRoutes` |
| Test files | `<SourceFile>.test.ts(x)` in `__tests__/` | `health.test.ts`, `Dashboard.test.tsx` |

## Code Style

### Formatter (Biome 2.4.5)

Both `apps/web` and `apps/server` share the same Biome config:

- **Indent:** 2 spaces
- **Line width:** 100 characters
- **Linter:** Recommended rules enabled, `noExplicitAny: off`
- **CSS linting:** Disabled (web only)

### TypeScript

- **Strict mode:** Enabled via shared `packages/tsconfig/base.json`
- **Target:** ES2022
- **Module:** ESNext with `bundler` module resolution
- **Composite projects** with `outDir`/`rootDir` in each app
- `type` keyword used for type-only imports: `import type { FastifyInstance } from "fastify"`
- `interface` used for object shapes (e.g., `interface Product`, `interface AnalyticsData`)
- Params often cast inline: `request.params as { slug: string }` (no Fastify schema types)
- Server uses Zod for runtime validation (e.g., `checkoutBodySchema`)

### React

- Functional components with `function` declarations (not arrow functions)
- Named exports preferred: `export function Dashboard()`
- One exception: `App.tsx` uses `export default function App()`
- Inline styles via `style` prop objects (not Tailwind classes, despite Tailwind being installed)
- State managed with `useState`/`useEffect` hooks — no external state library
- Props destructured inline: `{ children }: { children: React.ReactNode }`

### Pre-commit

- Biome check runs on `.(ts|tsx|js|jsx)$` files via `.pre-commit-config.yaml`
- Uses `bun x biome check --write .` in both web and server directories

## Import Organization

Consistent ordering across the codebase:

1. **Node built-ins:** `import { randomUUID } from "node:crypto"` (uses `node:` prefix)
2. **External packages:** `import Fastify from "fastify"`, `import { z } from "zod"`
3. **Workspace packages:** `import { logger } from "@sellsnap/logger"`
4. **Internal absolute (web):** `import { Button } from "@/components/ui/button"` (via `@/` alias)
5. **Relative imports:** `import { prisma } from "../lib/prisma"`
6. **Type-only imports:** `import type { FastifyInstance } from "fastify"` (separate or inline)

Web app uses `@/` path alias mapped to `./src/*` in `tsconfig.json` and `vite.config.ts`.

## Error Handling

### Server (Fastify)

- Early-return pattern with HTTP status codes:
  ```typescript
  if (!session?.user) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  ```
- Consistent error response shape: `{ error: string }`, sometimes with `{ error: string, code: string }`
- `try/catch` for external operations (Stripe webhooks, auth handler)
- Prisma errors checked via `error.code === "P2002"` for unique constraint violations
- Validation errors return 400, auth errors return 401/403, not-found returns 404

### Client (React)

- `try/catch` in form handlers with error state:
  ```typescript
  try { ... } catch (err) {
    setError(err instanceof Error ? err.message : "Sign in failed");
  } finally { setLoading(false); }
  ```
- API functions throw `new Error()` on non-ok responses, parsing the error from JSON
- Error messages displayed in colored `<div>` blocks with red background
- Loading state tracked via `useState<boolean>` with disabled buttons

## Logging

- **Server:** Uses `@sellsnap/logger` package wrapping `consola` (level-based logging)
  - `logger.success()` for success events
  - `logger.error()` for error conditions
  - `logger.box()` for formatted output (email preview)
  - Fastify's built-in `server.log.error()` also used in auth routes
  - `console.warn()` used as fallback in `stripe.ts` initialization
- **Log level:** Configurable via `LOG_LEVEL` env var; production defaults to 3, dev to 4
- **Client:** No structured logging — uses console only in tests

## Comments

- **Minimal comments** throughout the codebase
- Only present for non-obvious behavior: `// Ignore parsing errors, customerEmail is optional`
- No JSDoc or TSDoc annotations on functions
- No file-level header comments
- No TODO/FIXME comments observed

## Function Design

### Server Route Handlers

- Route plugins follow Fastify plugin pattern: `async function xyzRoutes(server: FastifyInstance): Promise<void>`
- Each route file exports a single plugin function registering one or more routes
- Route handlers are async, return values directly (Fastify auto-serializes to JSON)
- Authentication checked at the top of each handler (repeated pattern, no middleware)
- Request params cast inline rather than using Fastify schema validation

### Client API Functions

- Standalone async functions in `lib/api.ts` (not classes)
- Each function handles its own fetch, error checking, and JSON parsing
- Pattern: check `response.ok`, parse error body with `.catch()` fallback, throw `Error`
- Return typed results directly

### Utility Functions

- Pure functions exported individually: `validateImageFile()`, `headersToHeaders()`, `formatPrice()`
- Return `null` for success / `string` for error in validation functions

## Module Design

### Monorepo Structure

```
apps/web/          → React SPA (Vite, React Router, better-auth client)
apps/server/       → Fastify API (better-auth server, Prisma, Stripe)
packages/db/       → Prisma schema & client
packages/logger/   → Shared logger (consola wrapper)
packages/tsconfig/ → Shared TypeScript base config
```

### Server Module Organization

- `src/index.ts` — App bootstrap, plugin registration, server startup
- `src/routes/` — One file per resource domain (products, auth, checkout, etc.)
- `src/lib/` — Shared utilities (prisma, auth, stripe, upload, email)
- Each lib module exports singleton instances or utility functions

### Web Module Organization

- `src/main.tsx` → `src/App.tsx` — Entry and routing
- `src/pages/` — Page-level components (PascalCase)
- `src/components/` — Shared layout/UI components
- `src/lib/` — API client, auth client, session helpers
- `src/test/` — Test setup and utilities

### Key Patterns

- **Singleton services:** `prisma`, `stripe`, `auth`, `logger` are module-level singletons
- **No dependency injection** — modules import singletons directly
- **No barrel exports** — each module imported individually by path
- **Workspace packages** referenced via `workspace:*` in `package.json`
- **ESM throughout** — `"type": "module"` in all packages
