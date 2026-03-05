# Coding Conventions

**Analysis Date:** 2026-03-05

## Naming Patterns

**Files:**
- PascalCase for React components: `Dashboard.tsx`, `AppLayout.tsx`
- camelCase for utilities: `api.ts`, `auth.ts`, `session.ts`

**Functions:**
- camelCase: `useEffect`, `fetchProducts`, `handleSubmit`

**Variables:**
- camelCase: `isLoading`, `error`, `product`
- Boolean prefixes: `is*`, `has*` for boolean variables (`isLoading`, `hasProducts`)

**Types:**
- PascalCase: `AnalyticsData`, `Product`, `Session`
- Interfaces not used (type aliases preferred)

## Code Style

**Formatting:**
- Tool: Biome 2.4.5
- Key settings:
  - 2-space indentation
  - 100-character line width
  - Trailing commas omitted
  - Single quotes for strings
  - Semicolons required

**Linting:**
- Tool: Biome (recommended rules enabled)
- Notable: `noExplicitAny` disabled (explicit `any` allowed)

## Import Organization

**Order:**
1. External imports (React, third-party packages)
2. Internal imports (@/* path aliases)
3. Relative imports (../, ./)

**Path Aliases:**
- `@/*` → `apps/web/src/*` (configured in `apps/web/tsconfig.json`)

## Error Handling

**Patterns:**
- try/catch with async/await
- Error state stored in variables: `const [error, setError] = useState<string>()`
- Fallback error messages when JSON parsing fails
- No global error boundary implemented

## Logging

**Framework:** Console only (no structured logging)

**Patterns:**
- `console.log()` for development debugging
- `console.log()` for email logging in development (placeholder for actual email service)
- No ERROR, WARN, or DEBUG levels used

## Comments

**When to Comment:**
- Minimal usage (code is generally self-documenting)
- No explicit commenting guidelines observed

**JSDoc/TSDoc:**
- Not used (no type documentation comments found)

## Function Design

**Size:** Small to medium functions (5-274 lines)
- Most functions under 50 lines
- Large components (Dashboard.tsx at 274 lines) could be refactored

**Parameters:**
- Destructured objects preferred for component props: `{ children, title }`
- Explicit types for parameters

**Return Values:**
- Explicit return types where meaningful
- Type inference used for simple cases
- Async functions return `Promise<T>`

## Module Design

**Exports:**
- Named exports preferred: `export async function fetchProducts()`
- No default exports (except for React components where common)

**Barrel Files:**
- Not used (no `index.ts` barrel files for component/modules)
- Direct imports from component directories

---

*Convention analysis: 2026-03-05*
