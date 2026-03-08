# CONVENTIONS.md - Code Conventions

## Overview
SellSnap follows strict TypeScript conventions with emphasis on type safety, readability, and consistency across the monorepo.

---

## TypeScript Conventions

### Type Safety
- **Strict Mode**: Enabled for all packages
- **No `any`**: Unless absolutely necessary
- **Explicit Types**: Exported functions have explicit return types
- **Type vs Interface**:
  - Use `type` for unions and intersections
  - Use `interface` for object shapes

```typescript
// ✅ Good
type Result<T> = { success: true; data: T } | { success: false; error: string };

interface User {
  id: string;
  email: string;
}

// ❌ Avoid
function processData(data: any): any { ... }
```

### Type Imports
Use `import type` for type-only imports:

```typescript
import type { User, Product } from "@/types";
import { useState } from "react"; // Value import
```

---

## Import Order Convention

**Order**: External → Internal → Relative → Type imports

```typescript
// 1. External dependencies
import { useState } from "react";
import { Button } from "@/components/ui/button";

// 2. Internal modules (with @ alias)
import { formatPrice } from "@/lib/format";
import { type User } from "@/types/user";

// 3. Relative imports
import { Footer } from "./Footer";
import { type LocalType } from "./types";
```

---

## Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Files (utils) | camelCase | `format.ts`, `api.ts` |
| Files (components) | PascalCase | `AppLayout.tsx`, `Button.tsx` |
| Files (test) | *.test.ts | `auth.test.ts` |
| Folders | kebab-case | `__tests__/`, `e2e/` |
| Variables | camelCase | `userName`, `productId` |
| Functions | camelCase | `formatPrice()`, `createUser()` |
| Components | PascalCase | `function AppLayout()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_UPLOAD_SIZE` |
| Types | PascalCase | `type User`, `interface Product` |
| Enums | PascalCase | `enum UserRole` |
| Database tables | PascalCase | `User`, `Product`, `Order` |
| Database fields | camelCase | `createdAt`, `stripePriceId` |

---

## Code Style

### Functions
- Prefer `function` declarations for components
- Use arrow functions for callbacks and short utilities
- Extract complex logic into named functions

```typescript
// ✅ Component declaration
export function AppLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

// ✅ Utility arrow function
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
};
```

### Guard Clauses
Move preconditions to the top and return early:

```typescript
// ✅ Guard clauses
function processUser(user?: User) {
  if (!user) return;
  if (!user.isActive) return;
  if (!user.hasPermission) return;

  // Main logic
}

// ❌ Nested conditions
function processUser(user?: User) {
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) {
        // Main logic
      }
    }
  }
}
```

### Error Handling
- Use try/catch with async/await
- Return typed error results

```typescript
type Result<T> = { success: true; data: T } | { success: false; error: string };

async function getUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return { success: false, error: "User not found" };
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: "Failed to fetch user" };
  }
}
```

---

## React Conventions

### Component Structure
```typescript
// 1. Imports (external → internal → relative)
import { useState } from "react";

// 2. Type imports
import type { Product } from "@/types";

// 3. Component declaration
export function ProductPage({ productId }: { productId: string }) {
  // 4. Hooks (top level)
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 5. Event handlers
  const handleBuy = async () => {
    // ...
  };

  // 6. Effects
  useEffect(() => {
    // ...
  }, [productId]);

  // 7. Conditional returns (guard clauses)
  if (!product) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  // 8. Render
  return (
    <div>
      <h1>{product.name}</h1>
      <button onClick={handleBuy}>Buy</button>
    </div>
  );
}
```

### Hooks
- Custom hooks in `lib/` directory
- Prefix with `use`: `useAuth()`, `useProducts()`
- Extract reusable logic from components

---

## API Route Conventions

### File Organization
One file per domain in `apps/server/src/routes/`:

```
routes/
├── auth.ts         # All auth endpoints
├── products.ts     # All product endpoints
├── checkout.ts     # Checkout flow
└── webhooks.ts     # Webhook handlers
```

### Route Handler Pattern
```typescript
// ✅ Consistent route structure
app.route({
  method: "GET",
  url: "/api/products/:id",
  handler: async (request, reply) => {
    try {
      // 1. Validate input
      const { id } = request.params as { id: string };

      // 2. Business logic
      const product = await db.product.findUnique({ where: { id } });

      // 3. Error handling
      if (!product) {
        return reply.status(404).send({ error: "Product not found" });
      }

      // 4. Response
      return { success: true, data: product };
    } catch (error) {
      // 5. Error response
      return reply.status(500).send({ error: "Internal server error" });
    }
  },
});
```

---

## Database Conventions

### Schema Organization (`prisma/schema.prisma`)
- Group related models together
- Use descriptive field names
- Add indexes for frequently queried fields
- Use `@default(uuid())` for IDs
- Use `@updatedAt` for automatic timestamps

```prisma
model Product {
  id          String   @id @default(uuid())
  name        String
  price       Int
  description String?
  imageUrl    String?
  fileUrl     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  orders      Order[]
}

model Order {
  id         String   @id @default(uuid())
  userId     String
  productId  String
  product    Product  @relation(fields: [productId], references: [id])
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([productId])
}
```

---

## Testing Conventions

### AAA Pattern
Always follow Arrange, Act, Assert:

```typescript
test("should increment counter when button is clicked", () => {
  // Arrange
  render(<Counter />);
  const button = screen.getByRole("button", { name: /increment/i });
  const counter = screen.getByTestId("counter-value");

  // Act
  fireEvent.click(button);

  // Assert
  expect(counter).toHaveTextContent("1");
});
```

### Test Organization
- Test files in `__tests__/` folders alongside source
- E2E tests in `e2e/tests/`
- One test file per source file
- Descriptive test names (`should ... when ...`)

---

## Environment Variables

### Required (always set)
```bash
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
FRONTEND_URL=
CORS_ORIGIN=
API_URL=
```

### Optional
```bash
LOG_LEVEL=info
```

### Naming
- SCREAMING_SNAKE_CASE
- Group by purpose with comments
- Document in `.env.example`

---

## Comments & Documentation

### When to Comment
- Explain **why**, not **what**
- Document non-obvious decisions
- Add TODOs for future work

```typescript
// ✅ Good: Explains why
// Using bcrypt with 10 rounds for security vs performance balance
const hash = await bcrypt.hash(password, 10);

// ❌ Bad: States the obvious
// Set the user's email
user.email = email;
```

### JSDoc
Use for exported functions with complex behavior:

```typescript
/**
 * Creates a Stripe checkout session for a product.
 * @param productId - The product ID to purchase
 * @returns Checkout URL or error message
 */
export async function createCheckoutSession(productId: string) {
  // ...
}
```

---

## File Size Guidelines

- **Target**: Keep files under 200 lines
- **Maximum**: 300 lines (extract if exceeded)
- **Split**: Large components into smaller sub-components

---

## Monorepo Conventions

### Internal Dependencies
Use `workspace:*` protocol in `package.json`:

```json
{
  "dependencies": {
    "db": "workspace:*",
    "logger": "workspace:*"
  }
}
```

### Shared Code Location
- **Database**: `packages/db/`
- **Utilities**: Consider if truly shared before creating package
- **Types**: Prefer defining in app that uses them, unless truly shared

---

## Git Conventions

### Commit Messages
- Use clear, descriptive messages
- Separate tidying from behavior changes
- Reference issues when applicable

```
feat: add Stripe checkout integration
fix: resolve auth token expiration issue
refactor: extract file upload logic to lib/upload.ts
```

---

## CSS/Styling Conventions

### Tailwind CSS v4
- Use utility classes over custom CSS
- Keep custom CSS in `index.css`
- Use `@apply` sparingly

```tsx
// ✅ Tailwind utilities
<div className="flex items-center gap-4 p-4 rounded-lg bg-white shadow-md">

// ❌ Custom CSS (avoid when possible)
<div style={{ display: 'flex', padding: '16px' }}>
```

---

## Path Conventions Summary

| Pattern | Example |
|---------|---------|
| React components | `@/components/ComponentName` |
| Pages | `@/pages/PageName` |
| Utilities | `@/lib/utilName` |
| Types | `@/types/typeName` |
| API routes | `/api/resourceName` |
| Shared packages | `db`, `logger` |
