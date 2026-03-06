# AGENTS.md - Agent Coding Guidelines

SellSnap is a monorepo for selling digital products online (React + Fastify + Prisma + PostgreSQL).

```
apps/
  web/     # React (Vite) frontend
  server/  # Fastify API server
packages/
  db/      # Prisma schema & client
```

Tech stack: React 19, Vite, TypeScript (strict), Tailwind CSS v4, Prisma, Fastify, better-auth, Stripe.

---

## Build / Development Commands

Uses `pnpm` as package manager. Prefer `just` CLI for shortcuts.

```bash
# Install & run
just install           # pnpm install
just dev               # Start all dev servers (web + server)

# Type checking
just typecheck         # Type check all packages
just typecheck-web     # Web only
just typecheck-server  # Server only

# Build & lint
just build-web         # Build web app
just lint              # Biome lint + format (apps/web & apps/server)

# Testing
just test              # Run all tests
just test-watch        # Watch mode
just test-file <file>  # Run single test file (e.g., src/components/__tests__/MyComponent.test.tsx)

# Alternative: pnpm directly
cd apps/web && pnpm vitest run src/components/__tests__/MyComponent.test.tsx
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

### Testing (Vitest + @testing-library/react)

- Follow AAA pattern: Arrange, Act, Assert
- Test behavior, not implementation details

```typescript
test("should increment counter when button is clicked", () => {
  render(<Counter />);
  const button = screen.getByRole("button", { name: /increment/i });
  fireEvent.click(button);
  expect(screen.getByTestId("counter-value")).toHaveTextContent("1");
});
```

---

## Database / Prisma

- Use Prisma client for all database operations
- Name migrations descriptively: `just prisma-migrate add_product_slug`
- Use transactions for multi-step operations
- Required env vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `DATABASE_AUTH_TOKEN`

---

## API Design (Fastify)

- Use typed request/response schemas
- Return consistent response format
- Validate inputs using Fastify schema validation

---

## CSS / Styling

- Use Tailwind CSS v4
- Keep custom CSS minimal
- Use utility classes

---

## Linting & Formatting

Biome is configured in `apps/web/biome.json` and `apps/server/biome.json`.

```bash
just lint              # Runs on both web and server
cd apps/web && bun x biome check --write .
cd apps/server && bun x biome check --write .
```

Pre-commit hooks run automatically on commit (via prek).

---

## Git Conventions

- Use clear commit messages
- Run `pnpm typecheck` before committing
