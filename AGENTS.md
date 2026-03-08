# AGENTS.md - Agent Coding Guidelines

SellSnap monorepo for selling digital products (React + Fastify + Prisma + PostgreSQL).

```
apps/
  web/     # React (Vite) frontend
  server/  # Fastify API server
packages/
  db/      # Prisma schema & client
  logger/  # Logging utility
```

Tech stack: React 19, Vite, TypeScript (strict), Tailwind CSS v4, Prisma, Fastify, better-auth, Stripe, Zod.

---

## Build / Development Commands

Uses `pnpm`. Prefer `just` CLI for shortcuts.

```bash
# Install & run
just install           # pnpm install
just dev               # Start all dev servers

# Type checking
just typecheck         # Type check all packages
just typecheck-web     # Web only
just typecheck-server  # Server only

# Build & lint
just build-web         # Build web app
just lint              # Biome lint + format
just format            # Biome format only

# Testing
just test              # Run all tests (web + server)
just test-watch        # Watch mode (web + server)
cd apps/web && pnpm vitest run <file>       # Single web test
cd apps/server && pnpm vitest run <file>    # Single server test

# E2E Testing
just e2e               # Run Playwright tests
just e2e-ui            # Run Playwright with UI

# Database
just prisma-migrate <name>   # Create migration
just prisma-generate          # Generate Prisma client
just prisma-push              # Push schema to DB
```

---

## Environment Setup

Copy from `.env.example`. Required vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`, `CORS_ORIGIN`, `API_URL`.

---

## Local Database Setup

```bash
docker-compose up -d   # PostgreSQL on port 5432
docker-compose down   # Stop services
```

Credentials: user `sellsnap`, password `sellsnap`, database `sellsnap`

```bash
just prisma-push              # Push schema (dev)
just prisma-migrate <name>    # Create migration
```

---

## Pre-commit Hooks

```bash
prek install          # Install hooks
prek run --all-files # Run all hooks manually
```

---

## Code Style Guidelines

### TypeScript

- Use strict TypeScript - no `any` unless necessary
- Use `type` for unions, `interface` for object shapes
- Prefer explicit return types for exported functions

### Imports (order: external → internal → relative)

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "../utils/format";
import { type User } from "@/types/user";
```

- Use path aliases (`@/` configured in web)
- Use named exports over default

### Naming Conventions

- Files: kebab-case (utils), PascalCase (components)
- Variables/functions: camelCase
- Components: PascalCase
- Constants: SCREAMING_SNAKE_CASE
- Test files: `*.test.ts` or `*.test.tsx` in `__tests__` folders

### React Conventions

- Use functional components with hooks
- Use `function` declarations for components
- Extract custom hooks for reusable logic

### Error Handling

- Use try/catch with async/await
- Return typed error results: `type Result<T> = { success: true; data: T } | { success: false; error: string }`
- Never expose internal errors to clients

---

## Testing (Vitest + @testing-library/react)

Follow AAA pattern: Arrange, Act, Assert. Test behavior, not implementation details.

---

## Database / Prisma

- Use Prisma client: `import { db } from "db"`
- Use transactions for multi-step operations

---

## CSS / Styling

- Use Tailwind CSS v4
- Configure in `apps/web/src/index.css` with `@import "tailwindcss"`
- Keep custom CSS minimal

---

## Path Aliases

Web app uses `@/` as base: `@/components/*`, `@/lib/*`, `@/types/*` → `apps/web/src/*`

---

## Git Conventions

- Use clear commit messages
- Run `just typecheck` before committing
- Separate tidying from behavior changes
