# Deployment Guide

This document covers deployment to Dokku.

## Prerequisites

- Dokku server configured
- Git remote set up for Dokku
- Environment variables configured on server

## Environment Variables

Set these on your Dokku server:

```bash
# Required
dokku config:set store DATABASE_URL="postgresql://..."
dokku config:set store BETTER_AUTH_SECRET="your-secret-min-32-chars"
dokku config:set store DATABASE_AUTH_TOKEN="your-auth-token"

# Optional (with defaults)
dokku config:set store VITE_API_URL="https://your-domain.com"
dokku config:set store STRIPE_SECRET_KEY="sk_..."
dokku config:set store STRIPE_WEBHOOK_SECRET="whsec_..."
dokku config:set store SMTP_HOST="smtp.example.com"
dokku config:set store SMTP_PORT="587"
dokku config:set store SMTP_USER="user@example.com"
dokku config:set store SMTP_PASS="password"
```

## Deploy

```bash
# Push to Dokku
git push docklight main
```

## Troubleshooting

### Port 80 Already in Use (EADDRINUSE)

If you see `EADDRINUSE: address already in use 0.0.0.0:80`:

```bash
# Stop all containers
dokku ps:stop store

# Or restart the app
dokku ps:restart store
```

### View Logs

```bash
dokku logs store
dokku logs store --tail 100
```

### Run Migrations

```bash
# Run Prisma migrations in the container
dokku run store sh -c "cd /app/packages/db && npx prisma migrate deploy"
```

### Database Setup

```bash
# Push database schema
dokku run store sh -c "cd /app/packages/db && npx prisma db push"
```
