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
just test-watch        # Watch mode
just test-file <file>  # Single test file (e.g., src/components/__tests__/My.test.tsx)
cd apps/web && pnpm vitest run                    # Web tests only
cd apps/server && pnpm vitest run                 # Server tests only

# E2E Testing
just e2e               # Run Playwright tests
just e2e-ui           # Run Playwright with UI

# Prisma / Database
just prisma-migrate <name>   # Create migration
just prisma-generate          # Generate Prisma client
just prisma-push              # Push schema to DB
```

**Required env vars**: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `STRIPE_KEY`, `STRIPE_WEBHOOK_SECRET`

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
- Return typed error results or use Error boundaries
- Never expose internal errors to clients

```typescript
type Result<T> = { success: true; data: T } | { success: false; error: string };

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return { success: false, error: "User not found" };
    return { success: true, data: user };
  } catch {
    return { success: false, error: "Failed to fetch user" };
  }
}
```

### Fastify API Patterns

- Use Zod for validation, define schemas separately from routes

---

## Testing (Vitest + @testing-library/react)

- Follow AAA pattern: Arrange, Act, Assert
- Test behavior, not implementation details
- Use `describe` blocks to group related tests

---

## Database / Prisma

- Use Prisma client: `import { db } from "db"`
- Name migrations descriptively: `just prisma-migrate add_product_slug`
- Use transactions for multi-step operations

---

## CSS / Styling

- Use Tailwind CSS v4
- Keep custom CSS minimal
- Configure in `apps/web/src/index.css` with `@import "tailwindcss"`

---

## Linting & Formatting

Biome is configured in `apps/web/biome.json` and `apps/server/biome.json`.

```bash
just lint              # Runs on both web and server
just format            # Format only
```

Pre-commit hooks run automatically on commit (via prek).

---

## Git Conventions

- Use clear commit messages
- Run `just typecheck` before committing
- Separate tidying from behavior changes
