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

# Lint and format with Biome (web + server)
lint:
	cd apps/web && pnpm biome check --write .
	cd apps/server && pnpm biome check --write .

# Format only
format:
	cd apps/web && pnpm biome format --write .
	cd apps/server && pnpm biome format --write .

# Run tests (web + server)
test:
	cd apps/web && pnpm vitest run
	cd apps/server && pnpm vitest run

# Run tests watch mode (web + server)
test-watch:
	cd apps/web && pnpm vitest
	cd apps/server && pnpm vitest

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

# E2E tests (requires dev servers running or starts them automatically)
e2e:
    pnpm exec playwright test

# E2E tests with UI
e2e-ui:
    pnpm exec playwright test --ui
