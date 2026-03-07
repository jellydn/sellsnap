# SellSnap

> Sell in a snap — the fastest way for creators to sell digital products online.

SellSnap is a lightweight platform that lets creators upload a digital file, set a price, and start selling within minutes through a simple product page and shareable link.

## Tech Stack

| Layer    | Technology                     |
| -------- | ------------------------------ |
| Frontend | React (Vite) + React Router    |
| Backend  | Node.js / Fastify              |
| Database | PostgreSQL + Prisma ORM        |
| Auth     | better-auth (email/password)   |
| Payments | Stripe Checkout                |
| Storage  | Local filesystem (S3/R2 later) |
| Styling  | Tailwind CSS                   |
| Monorepo | pnpm workspaces                |

## Project Structure

```
apps/
  web/          # React (Vite) frontend
  server/       # Fastify API server
packages/
  db/           # Prisma schema & client
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
pnpm db:migrate
# Or: just prisma-migrate add_initial_schema

# Start development servers
pnpm dev
# Or: just dev
```

### Using just (recommended)

```bash
just install           # Install dependencies
just dev               # Start all dev servers
just typecheck         # Type check all packages
just build-web         # Build web app
just lint              # Lint and format
just test              # Run tests

# Database commands
just prisma-migrate <name>   # Create and run migration
just prisma-push              # Push schema to database
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sellsnap
BETTER_AUTH_SECRET=your-secret-at-least-32-chars
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:5173
```

## Features

- **Creator accounts** — sign up, manage products, view sales analytics
- **Product creation** — title, description, price, cover image, file upload
- **Shareable product pages** — `/p/:slug` with buy button
- **Creator profiles** — `/:creatorSlug` listing all published products
- **Stripe payments** — hosted checkout with webhook confirmation
- **Secure file delivery** — signed download tokens with 24h expiration
- **Basic analytics** — views, purchases, revenue per product

## User Flow

```
Creator: Sign up → Create product → Upload file → Set price → Publish → Share link
Customer: Open product page → Click Buy → Pay via Stripe → Download file
```

## CI/CD

This project uses GitHub Actions for continuous integration and deployment.

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/test.yml` | Push to main/develop, PRs | Type check, lint, and unit tests |
| `.github/workflows/build.yml` | Push to main/develop, PRs | Build web app and server |
| `.github/workflows/e2e.yml` | Push to main/develop, PRs | End-to-end tests with Playwright |

### Status Badges

```markdown
[![Tests](https://github.com/YOUR_ORG/YOUR_REPO/actions/workflows/test.yml/badge.svg)]
[![Build](https://github.com/YOUR_ORG/YOUR_REPO/actions/workflows/build.yml/badge.svg)]
[![E2E](https://github.com/YOUR_ORG/YOUR_REPO/actions/workflows/e2e.yml/badge.svg)]
```

### Running E2E Tests Locally

```bash
# Install Playwright browsers
pnpm exec playwright install

# Run E2E tests
just e2e

# Run with UI
just e2e-ui
```

## License

MIT
