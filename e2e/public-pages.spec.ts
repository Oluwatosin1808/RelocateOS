import { test, expect } from "@playwright/test";

/**
 * E2E: public pages render without auth.
 * The dashboard pages redirect to /login when unauthenticated.
 */
test.describe("Public pages", () => {
  test("login page renders with form", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/RelocateOS|Sign in/i);
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toBeVisible();
  });

  test("privacy page renders", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("body")).toBeVisible();
  });

  test("unauthenticated dashboard redirects to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated scout redirects to login", async ({ page }) => {
    await page.goto("/scout");
    await expect(page).toHaveURL(/\/login/);
  });
});
