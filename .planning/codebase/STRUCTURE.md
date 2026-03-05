# Codebase Structure

**Analysis Date:** 2026-03-05

## Directory Layout

```
sell-snap/
├── apps/
│   ├── web/                    # React web application
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── lib/            # Utility libraries (api, auth, session)
│   │   │   ├── pages/          # Page components (Dashboard, ProductCreate, etc.)
│   │   │   ├── test/           # Test setup (currently empty)
│   │   │   ├── App.tsx         # Main app with routes
│   │   │   └── main.tsx        # Entry point
│   │   ├── index.html          # HTML template
│   │   ├── vite.config.ts      # Vite configuration
│   │   ├── biome.json          # Linting/formatting config
│   │   ├── tsconfig.json       # TypeScript config
│   │   └── package.json        # Web app dependencies
│   └── server/                 # Fastify API server
│       ├── src/
│       │   └── index.ts        # All server code (935 lines)
│       ├── biome.json          # Linting/formatting config
│       ├── tsconfig.json       # TypeScript config
│       ├── .env.example        # Environment variables template
│       └── package.json        # Server dependencies
├── packages/
│   ├── db/                     # Shared database package
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   └── src/
│   │       └── index.ts        # Prisma client export
│   └── tsconfig/               # Shared TypeScript configs
│       └── base.json           # Base TS configuration
├── .planning/                  # Planning and documentation
├── pnpm-workspace.yaml         # pnpm workspace configuration
└── package.json                # Root workspace package.json
```

## Directory Purposes

**apps/web/src/components/:**
- Purpose: Reusable React UI components
- Contains: AppLayout, Layout, ProtectedRoute
- Key files: `ProtectedRoute.tsx` (route guards), `AppLayout.tsx` (main layout wrapper)

**apps/web/src/lib/:**
- Purpose: Shared utility functions and client libraries
- Contains: API client, auth utilities, session management
- Key files: `api.ts` (all API calls), `auth.ts` (better-auth client), `session.ts` (session utilities)

**apps/web/src/pages/:**
- Purpose: Page-level components for each route
- Contains: Dashboard, ProductCreate, ProductEdit, Settings, SignIn, SignUp, etc.
- Key files: `Dashboard.tsx` (analytics and product management), `ProductCreate.tsx` (product creation)

**apps/server/src/:**
- Purpose: All server-side code
- Contains: Fastify routes, handlers, middleware
- Key files: `index.ts` (monolithic server file with all endpoints)

**packages/db/:**
- Purpose: Database schema and Prisma client
- Contains: Prisma schema, migrations, generated client
- Key files: `prisma/schema.prisma` (User, Product, Purchase models)

## Key File Locations

**Entry Points:**
- `apps/web/src/main.tsx`: Web app bootstrap
- `apps/server/src/index.ts`: Server bootstrap
- `apps/web/index.html`: HTML template

**Configuration:**
- `apps/web/vite.config.ts`: Vite build config with proxy
- `pnpm-workspace.yaml`: Monorepo workspace definition
- `apps/server/.env.example`: Environment variables reference

**Core Logic:**
- `apps/web/src/lib/api.ts`: API client functions
- `apps/server/src/index.ts`: API route handlers
- `apps/web/src/pages/Dashboard.tsx`: Main dashboard with analytics

**Testing:**
- `apps/web/src/test/setup.ts`: Test setup (minimal, no tests written)
- `apps/web/vitest.config.ts`: Vitest configuration

## Naming Conventions

**Files:**
- PascalCase: React components and pages (`Dashboard.tsx`, `AppLayout.tsx`)
- camelCase: Utilities and libraries (`api.ts`, `auth.ts`, `session.ts`)
- kebab-case: Config files where appropriate (`vite.config.ts`)

**Directories:**
- kebab-case: `src/`, `pages/`, `components/`, `lib/`, `test/`
- All lowercase: No capital letters in directory names

## Where to Add New Code

**New Feature:**
- Primary code: `apps/web/src/pages/[FeatureName].tsx`
- Tests: `apps/web/src/test/[FeatureName].test.tsx`

**New Component/Module:**
- Implementation: `apps/web/src/components/[ComponentName].tsx`
- Shared utilities: `apps/web/src/lib/[utilityName].ts`

**New API Endpoint:**
- Implementation: `apps/server/src/index.ts` (add route handler)
- Types: `packages/db/prisma/schema.prisma` (if new model needed)

**Utilities:**
- Shared helpers: `apps/web/src/lib/[helperName].ts`

## Special Directories

**.planning/:**
- Purpose: Project planning and documentation
- Generated: Yes (by developers and tools)
- Committed: Yes (tracked in git)

**node_modules/:**
- Purpose: Dependency packages
- Generated: Yes (by pnpm install)
- Committed: No (gitignored)

**apps/web/dist/:**
- Purpose: Production build output
- Generated: Yes (by Vite build)
- Committed: No (gitignored)

**packages/db/prisma/migrations/:**
- Purpose: Database migration history
- Generated: Yes (by Prisma migrate)
- Committed: Yes (should be tracked for deployment)

---

*Structure analysis: 2026-03-05*
