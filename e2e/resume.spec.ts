import { test, expect } from "@playwright/test";

/**
 * /resume page E2E suite.
 *
 * Default state: NEXT_PUBLIC_RESUME_VARIANTS is unset (OFF).
 * Tests that require the flag set to "true" are marked with test.skip
 * and an inline instruction — run them locally after adding the flag.
 */

test.describe("/resume page — flag OFF (default)", () => {
  test("loads with h1 'Sairam Resume' and PDF tab active", async ({ page }) => {
    await page.goto("/resume");

    await expect(page.getByRole("heading", { name: "Sairam Resume", level: 1 })).toBeVisible();

    // PDF button is the active tab
    const pdfButton = page.getByRole("button", { name: "PDF résumé" });
    await expect(pdfButton).toBeVisible();
    await expect(pdfButton).toHaveAttribute("aria-pressed", "true");

    // Web button is inactive
    await expect(page.getByRole("button", { name: "Web résumé" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Master PDF iframe is present
    await expect(
      page.locator('iframe[title="Sairam Resume résumé preview"]'),
    ).toBeAttached();
  });

  test("variants section is absent from DOM when flag is OFF", async ({ page }) => {
    await page.goto("/resume");

    // The entire Section "// variants" must not be rendered
    await expect(page.locator("details")).not.toBeAttached();
    await expect(page.getByText("Role-targeted variants")).not.toBeVisible();
  });

  test("switches to Web view and shows inline HTML résumé", async ({ page }) => {
    await page.goto("/resume");

    await page.getByRole("button", { name: "Web résumé" }).click();

    // Web button becomes active
    await expect(page.getByRole("button", { name: "Web résumé" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Inline HTML résumé shows the owner's real name
    await expect(page.getByRole("heading", { name: "Sairam Ugge" })).toBeVisible();

    // iframe is removed from DOM (AnimatePresence unmounts the PDF tab tree)
    await expect(page.locator("iframe")).not.toBeAttached();
  });

  test("Web view PDF downloads section shows only master pill (flag OFF)", async ({ page }) => {
    await page.goto("/resume");

    await page.getByRole("button", { name: "Web résumé" }).click();
    await expect(page.getByRole("heading", { name: "Sairam Ugge" })).toBeVisible();

    // Only the master pill link is present
    await expect(page.getByRole("link", { name: /Sairam Resume/ })).toBeVisible();

    // Role-targeted variant pills must not exist in DOM at all (never rendered, not just hidden)
    await expect(page.getByRole("link", { name: /Backend/ })).not.toBeAttached();
    await expect(page.getByRole("link", { name: /Full-Stack/ })).not.toBeAttached();
  });

  test("returns to PDF view when PDF tab is re-clicked", async ({ page }) => {
    await page.goto("/resume");

    await page.getByRole("button", { name: "Web résumé" }).click();
    await expect(page.getByRole("heading", { name: "Sairam Ugge" })).toBeVisible();

    await page.getByRole("button", { name: "PDF résumé" }).click();

    await expect(page.getByRole("button", { name: "PDF résumé" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.locator('iframe[title="Sairam Resume résumé preview"]'),
    ).toBeAttached();
  });
});

test.describe("/resume page — flag ON (NEXT_PUBLIC_RESUME_VARIANTS=true)", () => {
  // These tests require the app to be running with NEXT_PUBLIC_RESUME_VARIANTS=true.
  // To run locally:
  //   echo "NEXT_PUBLIC_RESUME_VARIANTS=true" >> .env.local && pnpm dev
  //   pnpm e2e --grep "flag ON"
  // They are skipped in CI where the flag is unset.

  test.skip(
    process.env.NEXT_PUBLIC_RESUME_VARIANTS !== "true",
    "Requires NEXT_PUBLIC_RESUME_VARIANTS=true — see comment above",
  );

  test("variants section is present and collapsed by default", async ({ page }) => {
    await page.goto("/resume");

    const details = page.locator("details");
    await expect(details).toBeAttached();
    await expect(details).not.toHaveAttribute("open");
    await expect(page.getByText("Role-targeted variants")).toBeVisible();
  });

  test("expanding variants disclosure shows 4 role-targeted cards", async ({ page }) => {
    await page.goto("/resume");

    await page.locator("summary").click();

    await expect(page.getByRole("link", { name: "Download Backend résumé" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Full-Stack résumé" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Frontend résumé" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download GenAI résumé" })).toBeVisible();
  });

  test("Web view PDF downloads shows all 5 pills when flag is ON", async ({ page }) => {
    await page.goto("/resume");

    await page.getByRole("button", { name: "Web résumé" }).click();
    await expect(page.getByRole("heading", { name: "Sairam Ugge" })).toBeVisible();

    await expect(page.getByRole("link", { name: /Sairam Resume/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Backend/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Full-Stack/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Frontend/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /GenAI/ })).toBeVisible();
  });
});
