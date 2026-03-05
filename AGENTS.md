# AGENTS.md - Agent Coding Guidelines

This file provides guidelines for AI agents working on the SellSnap codebase.

## Project Overview

SellSnap is a monorepo for selling digital products online.

```
apps/
  web/          # React (Vite) frontend
  server/       # Fastify API server
packages/
  db/           # Prisma schema & client
```

Tech stack: React 18, Vite, TypeScript (strict), Tailwind CSS, Prisma, PostgreSQL, Fastify, better-auth, Stripe.

---

## Build / Development Commands

This project uses `pnpm` as the package manager. You can also use the `just` CLI for shortcuts.

### Using pnpm

```bash
# Install dependencies
pnpm install

# Or per workspace:
cd apps/web && pnpm install
cd apps/server && pnpm install
cd packages/db && pnpm install

# Start all dev servers (web + server)
pnpm dev

# Type check all packages
pnpm typecheck

# Type check specific package
pnpm typecheck:web
pnpm typecheck:server

# Build web app
cd apps/web && pnpm build
```

### Using just (recommended shortcuts)

```bash
# Install, dev, typecheck
just install
just dev
just typecheck
just typecheck-web
just typecheck-server

# Build web
just build-web

# Lint and format
just lint

# Run tests
just test              # Run all tests
just test-watch        # Watch mode
just test-file <file>  # Run single test file

# Prisma commands
just prisma-migrate <name>
just prisma-generate
just prisma-push
```

### Running a Single Test

**Option 1: Using just (recommended)**

```bash
just test-file src/components/__tests__/MyComponent.test.tsx
```

**Option 2: Using pnpm/vitest directly**

```bash
cd apps/web && pnpm vitest run src/components/__tests__/MyComponent.test.tsx

# Watch mode
cd apps/web && pnpm vitest src/components/__tests__/MyComponent.test.tsx
```

**Note:** This project does not have a test framework configured. To add tests:

```bash
cd apps/web && pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

---

## Code Style Guidelines

### TypeScript

- Use strict TypeScript - no `any` unless necessary
- Use `type` for unions, `interface` for object shapes
- Prefer explicit return types for exported functions

### Imports

- Use path aliases (`@/` configured in web)
- Order: external → internal → relative
- Use named exports over default

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "../utils/format";
import { type User } from "@/types/user";
```

### Naming Conventions

- Files: kebab-case (utils), PascalCase (components)
- Variables/functions: camelCase
- Components: PascalCase
- Constants: SCREAMING_SNAKE_CASE

### React Conventions

- Use functional components with hooks
- Use `function` declarations for components
- Extract custom hooks for reusable logic

### Error Handling

- Use try/catch with async/await
- Return typed error results or use Error boundaries

```typescript
type Result<T> = { success: true; data: T } | { success: false; error: string };
```

### Database / Prisma

- Use Prisma client for all database operations
- Name migrations descriptively: `just prisma-migrate add_product_slug`
- Use transactions for multi-step operations

### API Design (Fastify)

- Use typed request/response schemas
- Return consistent response format

### CSS / Styling

- Use Tailwind CSS
- Keep custom CSS minimal
- Use utility classes

---

## Linting & Formatting

Use Biome (configured in `apps/web/biome.json` and `apps/server/biome.json`):

```bash
# Run on web
cd apps/web && bun x biome check --write .

# Run on server
cd apps/server && bun x biome check --write .

# Or: just lint
```

Pre-commit hooks run automatically on commit (via prek, uses bun):

```bash
prek run --all-files
```

---

## Git Conventions

- Use clear commit messages
- Run `pnpm typecheck` before committing
