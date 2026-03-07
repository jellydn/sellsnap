# SellSnap

<div align="center">
  <img src="apps/web/public/logo-horizontal.svg" alt="SellSnap Logo" width="280" height="60" />
</div>

> Sell in a snap — the fastest way for creators to sell digital products online.

![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)

## Motivation

Selling digital products shouldn't require complex e-commerce platforms. For creators:

- Existing platforms charge high fees and require approval
- Setting up Stripe payments is complex
- File delivery needs secure handling
- Analytics should be simple and actionable

SellSnap fills the gap — a lightweight platform that gets you selling in minutes.

## Overview

SellSnap is a lightweight platform that lets creators upload a digital file, set a price, and start selling within minutes through a simple product page and shareable link.

Architecture:

```
Browser → React SPA → Fastify API → Prisma ORM → PostgreSQL
                                      ↓
                                  Stripe Checkout
```

## ✨ Features

- **Creator accounts** — sign up, manage products, view sales analytics
- **Product creation** — title, description, price, cover image, file upload
- **Shareable product pages** — `/p/:slug` with buy button
- **Creator profiles** — `/:creatorSlug` listing all published products
- **Stripe payments** — hosted checkout with webhook confirmation
- **Secure file delivery** — signed download tokens with 24h expiration
- **Basic analytics** — views, purchases, revenue per product

## 🧱 Tech Stack

| Layer | Stack |
| --- | --- |
| Backend | Node.js, Fastify, TypeScript |
| Frontend | React, Vite, Tailwind CSS, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Auth | better-auth (email/password) |
| Payments | Stripe Checkout |
| Storage | Local filesystem (S3/R2 later) |
| Monorepo | pnpm workspaces |

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL

### Installation

#### From Source (Local Development)

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

## 🛠️ Build Commands

```bash
# Show available commands
just

# Install dependencies
just install

# Run dev servers
just dev

# Quality checks
just lint
just format
just typecheck
just test

# Build
just build-web

# Database commands
just prisma-migrate <name>   # Create and run migration
just prisma-push              # Push schema to database
```

## 🔧 Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Secret for auth session encryption (min 32 chars) |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook secret for signature verification |
| `FRONTEND_URL` | Yes | Frontend URL for auth redirects (e.g., `http://localhost:5173`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |

## 🔒 Security Notes

SellSnap handles payments and file downloads.

- Always set a strong `BETTER_AUTH_SECRET`.
- Always use HTTPS in production.
- Keep Stripe webhook secrets secure.
- File download tokens expire after 24 hours.
- Stripe webhooks verify payment before granting access.

## 📦 Project Structure

```
sellsnap/
├── apps/
│   ├── web/           # React (Vite) frontend
│   └── server/        # Fastify API server
├── packages/
│   └── db/            # Prisma schema & client
├── .github/workflows  # CI/CD workflows
└── justfile           # Task runner commands
```

## 🧪 CI/CD

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `test.yml` | Push to main/develop, PRs | Type check, lint, and unit tests |
| `build.yml` | Push to main/develop, PRs | Build web app and server |
| `e2e.yml` | Push to main/develop, PRs | End-to-end tests with Playwright |

### Running E2E Tests Locally

```bash
# Install Playwright browsers
pnpm exec playwright install

# Run E2E tests
just e2e

# Run with UI
just e2e-ui
```

## 🤝 Contributing

Contributions are welcome. Please read our contributing guidelines before submitting PRs.

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

👤 __Dung Huynh__

- Website: https://productsway.com
- Twitter: @jellydn
- GitHub: @jellydn

## Show your support

Give a ⭐️ if this project helped you!

![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)
![PayPal](https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white)
![Buy Me A Coffee](https://img.shields.io/badge/Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)
