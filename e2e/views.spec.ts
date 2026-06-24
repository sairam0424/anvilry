import { test, expect } from "@playwright/test";

// ── Classic view (default, SSG, SEO) ──────────────────────────────────────────

test("classic view loads and shows portfolio content", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Sairam/i);
  // Hero section is present
  await expect(page.locator("main")).toBeVisible();
  // View switcher is available
  await expect(page.locator('[data-view]')).toBeVisible();
});

test("classic view: navigation to articles page works", async ({ page }) => {
  await page.goto("/articles");
  await expect(page).toHaveURL("/articles");
  await expect(page.locator("main")).toBeVisible();
});

test("classic view: navigation to projects page works", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL("/projects");
  await expect(page.locator("main")).toBeVisible();
});

test("classic view: navigation to work page works", async ({ page }) => {
  await page.goto("/work");
  await expect(page).toHaveURL("/work");
  await expect(page.locator("main")).toBeVisible();
});

// ── Chat view ─────────────────────────────────────────────────────────────────

test("chat view switches and renders chat interface", async ({ page }) => {
  await page.goto("/?view=chat");
  // Chat input is present
  await expect(page.locator('textarea, input[type="text"]').first()).toBeVisible({ timeout: 5000 });
});

test("chat view: typing a message and submitting works", async ({ page }) => {
  await page.goto("/?view=chat");
  const input = page.locator('textarea, input[type="text"]').first();
  await input.fill("What projects have you worked on?");
  await page.keyboard.press("Enter");
  // A response or loading indicator should appear
  await expect(page.locator('[data-role="assistant"], [aria-label*="thinking"], [aria-label*="loading"]').first()).toBeVisible({ timeout: 15000 });
});

// ── Developer (terminal) view ─────────────────────────────────────────────────

test("developer view switches and renders terminal", async ({ page }) => {
  await page.goto("/?view=developer");
  // Terminal prompt is present
  await expect(page.locator('[role="combobox"], [data-terminal], input').first()).toBeVisible({ timeout: 5000 });
});

test("developer view: 'help' command shows available commands", async ({ page }) => {
  await page.goto("/?view=developer");
  const input = page.locator('[role="combobox"]').first();
  await input.fill("help");
  await page.keyboard.press("Enter");
  await expect(page.locator("text=help").first()).toBeVisible({ timeout: 3000 });
});

// ── Gamified (3D graph) view ──────────────────────────────────────────────────

test("gamified view switches and renders 3D canvas", async ({ page }) => {
  await page.goto("/?view=gamified");
  // Canvas element from Three.js/R3F
  await expect(page.locator("canvas")).toBeVisible({ timeout: 8000 });
});

// ── SEO / discoverability ─────────────────────────────────────────────────────

test("llms.txt route is accessible", async ({ page }) => {
  const res = await page.goto("/llms.txt");
  expect(res?.status()).toBe(200);
});

test("sitemap.xml is accessible", async ({ page }) => {
  const res = await page.goto("/sitemap.xml");
  expect(res?.status()).toBe(200);
});

test("robots.txt is accessible", async ({ page }) => {
  const res = await page.goto("/robots.txt");
  expect(res?.status()).toBe(200);
});

// ── API smoke tests ───────────────────────────────────────────────────────────

test("resume.json API returns structured data", async ({ page }) => {
  const res = await page.goto("/api/resume.json");
  expect(res?.status()).toBe(200);
  const body = await res?.json();
  expect(body).toHaveProperty("basics");
});

test("MCP page renders", async ({ page }) => {
  await page.goto("/mcp");
  await expect(page.locator("main")).toBeVisible();
});
