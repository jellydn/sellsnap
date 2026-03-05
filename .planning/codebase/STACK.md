# Technology Stack

**Analysis Date:** 2026-03-05

## Languages

**Primary:**
- TypeScript 5.x - Web app (`apps/web/`), Server (`apps/server/`), Database (`packages/db/`)

**Secondary:**
- TSX - React components and pages
- CSS - Tailwind CSS classes (inline in components)
- Prisma Schema - Database schema definitions

## Runtime

**Environment:**
- Node.js (for server and build tooling)
- Browser (for web app client)

**Package Manager:**
- pnpm 9.x
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- React 19.0.0 - UI framework for web app
- React Router 7.1.3 - Client-side routing
- Fastify 5.2.0 - Backend API server
- Vite 6.0.1 - Build tool and dev server

**Testing:**
- Vitest 3.0.5 - Test runner (configured but no tests written)

**Build/Dev:**
- TypeScript 5.7.3 - Type checking
- Biome 2.4.5 - Linting and formatting
- Prisma 6.1.0 - ORM and database toolkit
- Tailwind CSS 4.x - Styling framework

## Key Dependencies

**Critical:**
- better-auth 1.1.1 - Authentication library with session management
- @prisma/client 6.1.0 - Database ORM client
- stripe 17.6.0 - Payment processing
- react 19.0.0 - Core UI library
- react-router-dom 7.1.3 - Client routing

**Infrastructure:**
- @fastify/cors 10.0.1 - CORS handling
- @fastify/multipart 9.0.1 - File upload handling
- @fastify/rate-limit 10.2.1 - Rate limiting
- @fastify/static 7.0.4 - Static file serving
- @tanstack/react-query 5.62.11 - Server state management
- tailwindcss 4.1.11 - Utility-first CSS

## Configuration

**Environment:**
- `.env` files in each app directory
- `.env.example` in `apps/server/`
- Environment variables via `process.env`

**Build:**
- `apps/web/vite.config.ts` - Vite configuration with proxy to server
- `apps/web/tsconfig.json` - TypeScript config for web
- `apps/server/tsconfig.json` - TypeScript config for server
- `packages/tsconfig/base.json` - Shared TypeScript base config
- `apps/web/biome.json` - Biome linting config (2 spaces, 100 char width)
- `apps/server/biome.json` - Biome linting config

## Platform Requirements

**Development:**
- Node.js 18+ (required by pnpm workspace)
- pnpm 9.x
- PostgreSQL database (for Prisma)

**Production:**
- Vercel (configured for deployment)
- PostgreSQL database (Vercel Postgres or external)
- Stripe account (for payments)

---

*Stack analysis: 2026-03-05*
