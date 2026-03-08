# TESTING.md - Testing Practices

## Testing Framework Stack

### Unit & Integration Tests
- **Framework**: Vitest
- **React Testing**: @testing-library/react
- **Test Runner**: Vitest (integrated with Vite)
- **Mocking**: Vitest built-in mocking

### E2E Tests
- **Framework**: Playwright
- **Browser**: Chromium (default)
- **Test Files**: 10 E2E test files in `e2e/tests/`

---

## Test Organization

### Directory Structure

```
apps/
├── web/
│   └── src/
│       └── __tests__/           # Web app tests (if any)
└── server/
    └── src/
        ├── routes/
        │   ├── auth.ts
        │   └── __tests__/
        │       └── auth.test.ts  # Route tests
        └── lib/
            ├── upload.ts
            └── __tests__/
                └── upload.test.ts  # Utility tests

e2e/
└── tests/
    ├── auth.spec.ts      # Authentication E2E
    ├── products.spec.ts  # Product browsing E2E
    ├── checkout.spec.ts  # Purchase flow E2E
    └── files.spec.ts     # Download flow E2E
```

### Test File Naming
- Unit/Integration: `*.test.ts` or `*.test.tsx`
- E2E: `*.spec.ts`

---

## Testing Philosophy

### Testing Trophy Approach
Following Kent C. Dodds' testing philosophy:

```
    🏆 E2E Tests (Playwright)
         High confidence, slow, expensive
      ↑
   🥉 Integration Tests (Vitest)
         Good confidence, moderate speed
      ↑
  🥈 Unit Tests (Vitest)
         Low confidence, fast, cheap
 🏅 Static Analysis (Biome, TypeScript)
```

### Priority
1. **E2E Tests**: Critical user flows (auth, checkout, download)
2. **Integration Tests**: API endpoints, database operations
3. **Unit Tests**: Utilities, pure functions

---

## Test Structure (AAA Pattern)

All tests follow **Arrange, Act, Assert**:

```typescript
test("should create checkout session for product", async () => {
  // Arrange
  const product = await createTestProduct();
  const requestBody = { productId: product.id };

  // Act
  const response = await app.inject({
    method: "POST",
    url: "/api/checkout",
    payload: requestBody,
  });

  // Assert
  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.success).toBe(true);
  expect(body.data).toHaveProperty("checkoutUrl");
});
```

---

## Vitest Configuration

### Setup (`apps/web/vite.config.ts`, `apps/server/vite.config.ts`)
```typescript
test: {
  globals: true,
  environment: "jsdom", // For React tests
  setupFiles: "./src/__tests__/setup.ts",
}
```

### Running Tests
```bash
just test              # Run all tests
just test-watch        # Watch mode
cd apps/web && pnpm vitest run <file>     # Specific web test
cd apps/server && pnpm vitest run <file>  # Specific server test
```

---

## React Testing Library Patterns

### Component Testing
```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./Button";

test("should call onClick when clicked", () => {
  // Arrange
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click me</Button>);

  // Act
  const button = screen.getByRole("button", { name: /click me/i });
  fireEvent.click(button);

  // Assert
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

### Best Practices
- **Test behavior, not implementation**
- **Use getByRole** for accessibility
- **Avoid testing internal state**
- **Mock at network boundary**

---

## API Route Testing

### Fastify Route Tests
```typescript
import { buildApp } from "../helper"; // Test helper

test("GET /api/products returns product list", async () => {
  const app = await buildApp();

  // Create test data
  await db.product.create({ data: { name: "Test", price: 100 } });

  const response = await app.inject({
    method: "GET",
    url: "/api/products",
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.data).toHaveLength(1);
});
```

### Test Helper Pattern
Create test helpers for common setup:

```typescript
// apps/server/src/__tests__/helper.ts
export async function buildApp() {
  const app = fastify();
  await app.register(routes);
  return app;
}

export async function createTestUser(overrides = {}) {
  return db.user.create({
    data: { email: "test@example.com", ...overrides },
  });
}
```

---

## Mocking Strategy

### External Services
**Mock at network boundary**:
- Stripe: Mock `apps/server/src/lib/stripe.ts`
- Email: Mock email sending (when implemented)
- File uploads: Mock upload utilities

### Database
- Use test database or transactions
- Clean up after each test
- Or use in-memory SQLite for speed

```typescript
import { db } from "db";

beforeEach(async () => {
  // Setup: Create test data
});

afterEach(async () => {
  // Cleanup: Delete test data
  await db.order.deleteMany();
  await db.product.deleteMany();
  await db.user.deleteMany();
});
```

---

## E2E Testing (Playwright)

### Configuration (`e2e/playwright.config.ts`)
```typescript
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
});
```

### E2E Test Example
```typescript
import { test, expect } from "@playwright/test";

test("user can purchase a product", async ({ page }) => {
  // Navigate to product
  await page.goto("/products/test-product-id");

  // Click buy button
  await page.click('button:text("Buy Now")');

  // Should redirect to Stripe (mocked in dev)
  await expect(page).toHaveURL(/stripe/);

  // Complete payment
  // ... (depends on test setup)

  // Should redirect back with success
  await expect(page).toHaveURL(/success/);
});
```

### Running E2E Tests
```bash
just e2e           # Run all E2E tests
just e2e-ui        # Run with UI
```

---

## Coverage

### Current State
- **Total Test Files**: ~367 files (unit + E2E combined)
- **E2E Tests**: 10 test files

### Coverage Goals
- Critical paths: Auth, checkout, file download (E2E)
- Business logic: API routes, utilities (Vitest)
- Components: Key UI components (Vitest)

### Generating Coverage
```bash
pnpm vitest run --coverage
```

---

## CI/CD Testing

### GitHub Actions (`.github/workflows/ci.yml`)
On every push:
1. **Type Check**: `just typecheck`
2. **Lint**: `just lint`
3. **Unit Tests**: `just test`
4. **E2E Tests**: `just e2e`

### Pre-commit Hooks
```bash
prek install  # Install hooks
prek run --all-files  # Run manually
```

---

## Test Data Management

### Fixtures
Create reusable test data factories:

```typescript
// apps/server/src/__tests__/fixtures.ts
export const productFixture = {
  name: "Test Product",
  price: 1000,
  description: "A test product",
  fileUrl: "https://example.com/test.pdf",
};

export async function createProduct(overrides = {}) {
  return db.product.create({
    data: { ...productFixture, ...overrides },
  });
}
```

---

## Async Testing

### Use async/await
```typescript
test("async operation", async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});
```

### waitFor for UI updates
```typescript
import { waitFor } from "@testing-library/react";

await waitFor(() => {
  expect(screen.getByText("Loaded")).toBeInTheDocument();
});
```

---

## Error Testing

### Test Error Paths
```typescript
test("should return 404 for non-existent product", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/products/non-existent-id",
  });

  expect(response.statusCode).toBe(404);
});
```

---

## Performance Testing

### Test View Counting Optimization
The view count batching (10s intervals) needs specific testing:

```typescript
vi.useFakeTimers();

// Make multiple requests
await app.inject({ url: "/api/files/abc/download" });
await app.inject({ url: "/api/files/abc/download" });

// Fast-forward 10 seconds
vi.advanceTimersByTime(10000);

// Assert batch was written to DB
expect(db.product.update).toHaveBeenCalledWith(
  expect.objectContaining({ viewCount: { increment: 2 } })
);
```

---

## Best Practices Summary

1. **Test behavior, not implementation**
2. **Follow AAA pattern** (Arrange, Act, Assert)
3. **Use descriptive test names** (`should ... when ...`)
4. **Mock external dependencies**
5. **Clean up test data**
6. **Test critical paths with E2E**
7. **Keep tests fast** (use in-memory DB when possible)
8. **Use type-safe test helpers**
