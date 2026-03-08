import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: "html",
	use: {
		baseURL: "http://localhost:5173",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: [
		{
			command:
				"NODE_ENV=test DATABASE_URL='postgresql://sellsnap:sellsnap@localhost:5432/sellsnap' pnpm -F server dev",
			url: "http://localhost:3000/api/health",
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
		},
		{
			command: "pnpm -F web dev",
			url: "http://localhost:5173",
			reuseExistingServer: !process.env.CI,
			timeout: 30_000,
		},
	],
});
