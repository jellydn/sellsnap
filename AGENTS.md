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

This project uses `pnpm` as the package manager. Use `just` CLI for shortcuts.

### Using just (recommended)

```bash
just install           # Install dependencies
just dev               # Start all dev servers (web + server)
just typecheck          # Type check all packages
just typecheck-web      # Type check web only
just typecheck-server   # Type check server only
just build-web         # Build web app
just lint               # Lint and format (Biome)
just test               # Run all tests
just test-watch         # Watch mode
just test-file <file>   # Run single test file
```

### Using pnpm directly

```bash
pnpm install
pnpm dev
pnpm typecheck
cd apps/web && pnpm build
```

### Running a Single Test

```bash
# Using just (recommended)
just test-file src/components/__tests__/MyComponent.test.tsx

# Using pnpm/vitest directly
cd apps/web && pnpm vitest run src/components/__tests__/MyComponent.test.tsx

# Watch mode
cd apps/web && pnpm vitest src/components/__tests__/MyComponent.test.tsx
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
- Never expose internal errors to clients

```typescript
type Result<T> = { success: true; data: T } | { success: false; error: string };

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return { success: false, error: "User not found" };
    return { success: true, data: user };
  } catch (e) {
    return { success: false, error: "Failed to fetch user" };
  }
}
```

### Testing

- Use Vitest for unit and integration tests
- Follow AAA pattern: Arrange, Act, Assert
- Test behavior, not implementation details
- Use `@testing-library/react` for component tests

```typescript
test("should increment counter when button is clicked", () => {
  render(<Counter />);
  const button = screen.getByRole("button", { name: /increment/i });

  fireEvent.click(button);

  expect(screen.getByTestId("counter-value")).toHaveTextContent("1");
});
```

### Database / Prisma

- Use Prisma client for all database operations
- Name migrations descriptively: `just prisma-migrate add_product_slug`
- Use transactions for multi-step operations
- Environment variables: `DATABASE_URL` (required), check `.env.example` for others

### API Design (Fastify)

- Use typed request/response schemas
- Return consistent response format
- Validate inputs using Fastify schema validation

### Environment Variables

- Never commit secrets - use `.env` files
- Copy from `.env.example` for required variables
- Server requires: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `DATABASE_AUTH_TOKEN`

### CSS / Styling

- Use Tailwind CSS v4
- Keep custom CSS minimal
- Use utility classes

---

## Linting & Formatting

Uses Biome (configured in `apps/web/biome.json` and `apps/server/biome.json`):

```bash
# Run on web
cd apps/web && bun x biome check --write .

# Run on server
cd apps/server && bun x biome check --write .

# Or use just
just lint
```

Pre-commit hooks run automatically on commit (via prek, uses bun):

```bash
prek run --all-files
```

---

## Git Conventions

- Use clear commit messages
- Run `pnpm typecheck` before committing
