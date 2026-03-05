# SellSnap

> Sell in a snap — the fastest way for creators to sell digital products online.

SellSnap is a lightweight platform that lets creators upload a digital file, set a price, and start selling within minutes through a simple product page and shareable link.

## Tech Stack

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Frontend    | React (Vite) + React Router         |
| Backend     | Node.js / Fastify                   |
| Database    | PostgreSQL + Prisma ORM             |
| Auth        | better-auth (email/password)        |
| Payments    | Stripe Checkout                     |
| Storage     | Local filesystem (S3/R2 later)      |
| Styling     | Tailwind CSS                        |
| Monorepo    | pnpm workspaces                     |

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
cp apps/server/.env.example apps/server/.env

# Run database migrations
pnpm --filter server prisma migrate dev

# Start development servers
pnpm dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sellsnap
BETTER_AUTH_SECRET=your-secret
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

## License

MIT
