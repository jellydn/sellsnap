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

## Quick Start

```bash
just install       # Install dependencies
just dev           # Start all dev servers
```

---

## Build / Dev Commands

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
just lint              # Biome lint + format check
just format            # Biome format only

# Testing
just test              # Run all tests (web + server)
just test-watch        # Watch mode (web + server)

# Run single test file
cd apps/web && pnpm vitest run <file>       # e.g., apps/web/src/components/button.test.tsx
cd apps/server && pnpm vitest run <file>    # e.g., apps/server/src/routes/auth.test.ts

# E2E Testing
just e2e               # Run Playwright tests
just e2e-ui            # Run Playwright with UI

# Database
just prisma-migrate <name>   # Create migration
just prisma-generate         # Generate Prisma client
just prisma-push             # Push schema to DB
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

- Use strict TypeScript - no `any` unless absolutely necessary
- Use `type` for unions/intersections, `interface` for object shapes
- Prefer explicit return types for exported functions
- Enable `strict: true` in tsconfig

### Imports (order: external → internal → relative)

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "../utils/format";
import { type User } from "@/types/user";
```

- Use path aliases (`@/` configured in web)
- Use named exports over default exports

### Naming Conventions

| Type                | Convention                  | Example                     |
| ------------------- | --------------------------- | --------------------------- |
| Files (utils)       | kebab-case                  | `format-price.ts`           |
| Files (components)  | PascalCase                  | `Button.tsx`                |
| Variables/functions | camelCase                   | `getUserById`               |
| Components          | PascalCase                  | `function UserProfile() {}` |
| Constants           | SCREAMING_SNAKE_CASE        | `MAX_FILE_SIZE`             |
| Test files          | `*.test.ts` or `*.test.tsx` | `button.test.tsx`           |

### React Conventions

- Use functional components with hooks
- Use `function` declarations (not arrow functions)
- Extract custom hooks (`useAuth`, `useCart`)
- Keep components small and focused

### Error Handling

- Use try/catch with async/await
- Return typed error results:
  ```typescript
  type Result<T> =
    | { success: true; data: T }
    | { success: false; error: string };
  ```
- Never expose internal errors to clients

---

## Testing (Vitest + @testing-library/react)

Follow AAA pattern: **Arrange, Act, Assert**. Test behavior, not implementation details.

```typescript
test('should increment counter when button is clicked', () => {
  // Arrange
  render(<Counter />);
  const button = screen.getByRole('button', { name: /increment/i });
  // Act
  fireEvent.click(button);
  // Assert
  expect(screen.getByTestId('counter')).toHaveTextContent('1');
});
```

- Use `screen.getBy*` over `container.querySelector`

---

## Database / Prisma

- Use Prisma client: `import { db } from "db"`
- Use transactions for multi-step operations
- Run `just prisma-generate` after schema changes

---

## CSS / Styling

- Use Tailwind CSS v4 with `@import "tailwindcss"`
- Keep custom CSS minimal - use utility classes
- Use `cn()` utility for conditional classes

---

## Path Aliases

Web app uses `@/` as base path: `@/components/*`, `@/lib/*`, `@/types/*` → `apps/web/src/*`

---

## Git Conventions

- Use clear, descriptive commit messages
- Run `just typecheck` and `just lint` before committing
- Separate tidying commits from behavior changes
- Create feature branches for new features
