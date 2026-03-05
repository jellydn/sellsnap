# Justfile for SellSnap

# Install dependencies
install:
    pnpm install

# Start all dev servers
dev:
    pnpm dev

# Type check all
typecheck:
    pnpm typecheck

# Type check web
typecheck-web:
    pnpm typecheck:web

# Type check server
typecheck-server:
    pnpm typecheck:server

# Build web
build-web:
    cd apps/web && pnpm build

# Lint and format with Biome
lint:
    cd apps/web && pnpm biome check --write .

# Run tests (requires Vitest setup)
test:
    cd apps/web && pnpm vitest run

# Run tests watch mode
test-watch:
    cd apps/web && pnpm vitest

# Run single test file
test-file file:
    cd apps/web && pnpm vitest run {{file}}

# Prisma commands
prisma-migrate name:
    cd apps/server && pnpm prisma migrate dev --name {{name}}

prisma-generate:
    cd apps/server && pnpm prisma generate

prisma-push:
    cd apps/server && pnpm prisma db push
