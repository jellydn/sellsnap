# Technology Stack

**Analysis Date:** 2026-03-06

## Languages

| Language   | Version / Target | Usage                              |
| ---------- | ---------------- | ---------------------------------- |
| TypeScript | ^5.7.2 (strict)  | All application and package code   |
| SQL        | —                | Prisma migrations                  |
| CSS        | Tailwind v4      | Styling (utility-first)            |
| HTML       | —                | Single `index.html` SPA entry      |

- **TS target:** ES2022, module ESNext, `moduleResolution: "bundler"`
- Shared base tsconfig at `packages/tsconfig/base.json`; each app extends it with `composite: true`

## Runtime

| Runtime  | Version   | Context                                      |
| -------- | --------- | -------------------------------------------- |
| Node.js  | 20-alpine | Production (Docker images)                   |
| tsx      | ^4.19.2   | Dev server (`tsx watch`) & production runner  |
| Vite     | ^6.0.7    | Web dev server & build tool                  |

- Server runs via `tsx watch` in dev, `npx tsx` in Docker production
- Web served via `serve -s` (Dockerfile) or Vite dev server (port 5173)

## Frameworks

### Frontend (`apps/web/`)

| Framework        | Version  | Role                  |
| ---------------- | -------- | --------------------- |
| React            | ^19.0.0  | UI library            |
| React DOM        | ^19.0.0  | DOM rendering         |
| React Router DOM | ^7.1.1   | Client-side routing   |
| Tailwind CSS     | ^4.2.1   | Utility-first CSS     |
| Vite             | ^6.0.7   | Build tool & dev server |

- Vite plugins: `@vitejs/plugin-react`, `@tailwindcss/vite`
- Dev proxy: `/api` → `http://localhost:3000`
- Path alias: `@/` → `./src/`

### Backend (`apps/server/`)

| Framework            | Version  | Role                        |
| -------------------- | -------- | --------------------------- |
| Fastify              | ^5.2.1   | HTTP framework              |
| @fastify/cors        | ^11.2.0  | CORS support                |
| @fastify/multipart   | ^9.4.0   | File upload handling        |
| @fastify/rate-limit  | ^10.3.0  | API rate limiting           |
| @fastify/static      | ^9.0.0   | Static file serving (uploads) |
| Zod                  | ^4.0.0   | Request validation          |

- Server listens on port 3000
- Modular route structure: `routes/*.ts` registered as Fastify plugins
- Shared logic in `lib/` (auth, stripe, prisma, upload, email)

## Key Dependencies

### Shared Packages (internal)

| Package            | Path               | Purpose                          |
| ------------------ | ------------------ | -------------------------------- |
| `db`               | `packages/db/`     | Prisma schema & generated client |
| `@sellsnap/logger` | `packages/logger/` | Logging via consola              |
| `packages/tsconfig`| `packages/tsconfig/` | Shared TypeScript base config  |

### External Libraries

| Library                   | Version  | App    | Purpose                         |
| ------------------------- | -------- | ------ | ------------------------------- |
| better-auth               | ^1.5.3   | Both   | Authentication framework        |
| @better-auth/prisma-adapter | ^1.5.3 | Server | Prisma adapter for better-auth  |
| @better-fetch/fetch       | ^1.1.21  | Web    | Typed fetch client              |
| stripe                    | ^20.4.0  | Server | Payment processing              |
| @prisma/client            | ^6.19.2  | Server | Database ORM client             |
| consola                   | ^3.4.0   | Logger | Structured console logging      |

### Dev Tooling

| Tool                     | Version  | Purpose                      |
| ------------------------ | -------- | ---------------------------- |
| Biome                    | ^2.4.5   | Linting & formatting         |
| Vitest                   | ^4.0.18  | Unit/integration testing     |
| @testing-library/react   | ^16.3.2  | React component testing      |
| @testing-library/jest-dom | ^6.9.1  | DOM assertion matchers       |
| jsdom                    | ^28.1.0  | Test environment (web)       |
| PostCSS                  | ^8.5.8   | CSS processing               |
| Autoprefixer             | ^10.4.27 | CSS vendor prefixes          |

## Configuration

| Config File                      | Tool              |
| -------------------------------- | ----------------- |
| `apps/web/vite.config.ts`        | Vite + React + Tailwind plugins |
| `apps/web/vitest.config.ts`      | Vitest (jsdom env, globals, `@/` alias) |
| `apps/server/vitest.config.ts`   | Vitest (globals, mock env vars) |
| `apps/web/biome.json`            | Biome (space indent, 100 line width) |
| `apps/server/biome.json`         | Biome (space indent, 100 line width) |
| `packages/tsconfig/base.json`    | Shared TS config (ES2022, strict) |
| `apps/web/tsconfig.json`         | Web TS (JSX react-jsx, path alias) |
| `apps/server/tsconfig.json`      | Server TS (composite, skipLibCheck) |
| `.pre-commit-config.yaml`        | Pre-commit hooks (Biome via bun) |
| `justfile`                       | Task runner shortcuts |

## Platform Requirements

### Package Management

- **pnpm** v10.30.3 (workspace protocol for internal packages)
- Workspace: `apps/*`, `packages/*`

### Containerization

| File               | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `Dockerfile`       | Combined web+server (Node 20-alpine, `serve` + `tsx`, port 80) |
| `Dockerfile.server`| Server-only (Node 20-alpine, `tsx`, port 3000, non-root user) |
| `docker-compose.yml` | Full stack: web+server + PostgreSQL 16-alpine |
| `nginx.conf`       | SPA fallback config (unused in current Docker setup) |

### Database

- PostgreSQL 16 (Alpine) via Docker
- Prisma ORM with migration support
- Volume: `postgres_data` for persistence

### Node.js Version

- **Node 20** (specified in Docker images)
- ES module system (`"type": "module"` in apps)
