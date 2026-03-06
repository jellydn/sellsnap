# Testing Patterns

**Analysis Date:** 2026-03-06

## Test Framework

| Tool | Version | App |
|---|---|---|
| Vitest | ^4.0.18 | Both web and server |
| @testing-library/react | ^16.3.2 | Web only |
| @testing-library/jest-dom | ^6.9.1 | Web only (vitest matchers) |
| jsdom | ^28.1.0 | Web only (DOM environment) |

### Configuration

**Web (`apps/web/vitest.config.ts`):**
- Environment: `jsdom`
- Globals: `true` (no need to import `describe`, `it`, `expect`, `vi`)
- Setup file: `./src/test/setup.ts` (imports `@testing-library/jest-dom/vitest`)
- Path alias: `@/` → `./src/`
- React plugin via `@vitejs/plugin-react`

**Server (`apps/server/vitest.config.ts`):**
- Environment: default (Node.js)
- Globals: `true`
- Mock env vars set inline: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL`, `DATABASE_URL`
- No setup files

**TypeScript:** `"types": ["vitest/globals"]` in web `tsconfig.json` for global type support.

## Test File Organization

```
apps/web/src/
  components/__tests__/
    AppLayout.test.tsx
  pages/__tests__/
    Dashboard.test.tsx
    SignIn.test.tsx
    SignUp.test.tsx
    ProductPage.test.tsx
  test/
    setup.ts          # jest-dom matchers
    test-utils.tsx     # renderWithRouter, AllProviders

apps/server/src/
  routes/__tests__/
    health.test.ts
    checkout.test.ts
  lib/__tests__/
    auth.test.ts
    email.test.ts
    upload.test.ts
```

**Convention:** Tests live in `__tests__/` directories alongside their source modules. Test files named `<SourceFile>.test.ts(x)`.

## Test Structure

### Describe/It Pattern

All tests use `describe` → `it` blocks with descriptive names:

```typescript
describe("health routes", () => {
  it("GET /api/health returns ok", async () => { ... });
});
```

- Top-level `describe` groups by component/module name
- `it` descriptions start with a verb or state: "shows", "renders", "returns", "accepts", "rejects"
- No nested `describe` blocks observed

### Setup/Teardown

- `beforeEach` with `vi.clearAllMocks()` used in web tests
- `vi.restoreAllMocks()` used alongside `clearAllMocks` in `ProductPage.test.tsx`
- No `afterEach` or `beforeAll`/`afterAll` usage observed
- Server tests generally don't use lifecycle hooks (each test is self-contained)

## Mocking

### Web (React Components)

**Module mocking with `vi.mock()`:**
```typescript
vi.mock("../../lib/api", () => ({
  fetchProducts: vi.fn(),
  fetchAnalytics: vi.fn(),
}));
```

**Auth client mocking pattern:**
```typescript
const mockSignInEmail = vi.fn();
vi.mock("../../lib/auth", () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => mockSignInEmail(...args) },
    useSession: () => ({ data: null, isPending: false }),
  },
}));
```

**React Router mocking:**
```typescript
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});
```

**Typed mock references:**
```typescript
import { fetchProducts } from "../../lib/api";
const mockFetchProducts = fetchProducts as ReturnType<typeof vi.fn>;
```

**Global fetch mocking:**
```typescript
vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
  ok: true,
  json: () => Promise.resolve(mockProduct),
} as Response);
```

### Server

**Module mocking with `vi.mock()` + dynamic import:**
```typescript
vi.mock("better-auth", () => ({
  betterAuth: vi.fn(() => ({ api: {} })),
}));
const { headersToHeaders } = await import("../auth");
```

**Node.js built-in mocking:**
```typescript
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, writeFileSync: vi.fn(), existsSync: vi.fn(() => true) };
});
```

**Console spy:**
```typescript
const spy = vi.spyOn(console, "log").mockImplementation(() => {});
```

## Fixtures and Factories

### Inline Mock Data

No factory functions or fixture files. All mock data is defined inline as constants in test files:

```typescript
const mockProducts = [
  {
    id: "1",
    title: "Test Product",
    slug: "test-product",
    price: 999,
    // ...full object shape
  },
];
```

### Async Generator for Streams

Server tests use ad-hoc async generators for file stream mocking:

```typescript
async function* mockFileStream(data: string): AsyncGenerator<Buffer> {
  yield Buffer.from(data);
}
```

### No Shared Factories

Each test file defines its own mock data. No shared factory functions or builder patterns exist.

## Coverage

- No coverage configuration in vitest configs
- No coverage thresholds defined
- No coverage reporting tools installed
- Tests run via `vitest run` (no coverage flag by default)

## Test Types

### Unit Tests (Server)

- **Route integration tests:** Use `Fastify.inject()` for HTTP-level testing without a running server
  ```typescript
  const app = Fastify();
  await app.register(healthRoutes);
  const response = await app.inject({ method: "GET", url: "/api/health" });
  ```
- **Schema validation tests:** Directly test Zod schemas with `safeParse()`
- **Utility function tests:** Pure function input/output assertions
- **Module tests:** Test helper functions with mocked dependencies

### Component Tests (Web)

- All use `renderWithRouter()` from `test-utils.tsx` (wraps in `MemoryRouter`)
- Query elements using `@testing-library/react` queries:
  - `screen.getByText()`, `screen.getByRole()`, `screen.getByLabelText()`
  - `screen.getAllByText()` for multiple matches
  - `screen.getByTestId()` used once
- User interactions via `fireEvent.change()` and `fireEvent.click()`
- Async assertions wrapped in `waitFor(() => { ... })`

### No E2E Tests

No Playwright, Cypress, or other E2E testing framework is present.

## Common Patterns

### Loading → Content → Error

Web tests consistently verify three states:

```typescript
it("shows loading state initially", () => { ... });
it("renders content after fetch", async () => { ... });
it("shows error message on fetch failure", async () => { ... });
```

### Pending Promise for Loading State

```typescript
mockFetchProducts.mockReturnValue(new Promise(() => {})); // never resolves
renderWithRouter(<Dashboard />);
expect(screen.getByText("Loading products...")).toBeInTheDocument();
```

### Form Submission Tests

```typescript
fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
fireEvent.click(screen.getByRole("button", { name: "Sign In" }));
await waitFor(() => {
  expect(mockSignInEmail).toHaveBeenCalledWith({ email: "test@example.com", password: "..." });
});
```

### Button Disabled During Loading

```typescript
let resolveSignIn: (value: unknown) => void;
mockSignInEmail.mockImplementationOnce(() => new Promise((resolve) => { resolveSignIn = resolve; }));
// ...click submit
await waitFor(() => {
  expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
});
resolveSignIn({});
```

### Environment Variable Manipulation (Server)

```typescript
const originalEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "development";
// ...test
process.env.NODE_ENV = originalEnv;
```

### Render Helper

`renderWithRouter()` in `test-utils.tsx` wraps components in `MemoryRouter` with optional initial route:

```typescript
function renderWithRouter(ui: ReactElement, options?: RenderOptions & { route?: string }): RenderResult
```

### Navigation Assertions

```typescript
const link = screen.getByRole("link", { name: "Sign In" });
expect(link).toHaveAttribute("href", "/sign-in");
```

### Test Conventions Summary

| Practice | Status |
|---|---|
| Globals enabled (`describe`, `it`, `vi`) | ✅ |
| `beforeEach` with `vi.clearAllMocks()` | ✅ (web) |
| Inline mock data (no factories) | ✅ |
| `vi.mock()` for module mocking | ✅ |
| `waitFor` for async assertions | ✅ |
| Testing Library queries (role/label/text) | ✅ |
| `fireEvent` for interactions | ✅ |
| Fastify `inject()` for route tests | ✅ |
| Coverage configuration | ❌ |
| E2E tests | ❌ |
| Snapshot tests | ❌ |
