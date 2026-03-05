import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    env: {
      STRIPE_SECRET_KEY: "sk_test_mock",
      STRIPE_WEBHOOK_SECRET: "whsec_mock",
      FRONTEND_URL: "http://localhost:5173",
      DATABASE_URL: "postgresql://mock:mock@localhost:5432/mock",
    },
  },
});
