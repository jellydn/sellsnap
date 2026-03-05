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

**Note:** Use `bun` as the package manager instead of `pnpm` for better compatibility.

### Root Commands

```bash
# Install dependencies (from root, then each app)
bun install && cd apps/web && bun install && cd ../server && bun install && cd ../../packages/db && bun install

# Or install each workspace individually:
cd apps/web && bun install
cd apps/server && bun install
cd packages/db && bun install

# Start all dev servers (web + server)
pnpm dev

# Type check all packages
pnpm typecheck

# Type check specific package
pnpm typecheck:web
pnpm typecheck:server
```

### Web App (apps/web)

```bash
# Start dev server, build, preview, typecheck
pnpm dev
pnpm build
pnpm preview
pnpm typecheck
```

### Server (apps/server)

```bash
# Prisma commands
pnpm prisma migrate dev
pnpm prisma generate
pnpm prisma db push
```

### Running a Single Test

**Note:** This project does not currently have a test framework. To add tests:

```bash
cd apps/web
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom

# Run single test file
pnpm vitest run src/components/__tests__/MyComponent.test.tsx

# Run tests in watch mode
pnpm vitest
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
// Good
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

```typescript
export function ProductCard({ product }: ProductCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  return <div className="card">...</div>
}
```

### Error Handling

- Use try/catch with async/await
- Return typed error results or use Error boundaries

```typescript
type Result<T> = { success: true; data: T } | { success: false; error: string };
```

### Database / Prisma

- Use Prisma client for all database operations
- Name migrations descriptively: `pnpm prisma migrate dev --name add_product_slug`
- Use transactions for multi-step operations

### API Design (Fastify)

- Use typed request/response schemas
- Return consistent response format

```typescript
export async function productRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>('/products/:id', { schema: {...} }, async (request) => {
    const product = await prisma.product.findUnique({ where: { id: request.params.id } })
    if (!product) throw fastify.httpNotFound()
    return product
  })
}
```

### CSS / Styling

- Use Tailwind CSS
- Keep custom CSS minimal
- Use utility classes

---

## Linting & Formatting

Use Biome (configured in `apps/web/biome.json`):

```bash
# Check and format
cd apps/web && pnpm biome check --write .
```

Or with just: `just lint`

Pre-commit hooks run automatically on commit (via prek):

```bash
prek run --all-files
```

---

## Git Conventions

- Use clear commit messages
- Run `pnpm typecheck` before committing
