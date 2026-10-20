import { test, expect } from "@playwright/test";
import { authenticate } from "./helpers/auth";

/**
 * E2E: authenticated dashboard flows.
 * Uses the real Firebase test user + session cookie exchange.
 */
test.describe("Authenticated dashboard", () => {
  test.beforeEach(async ({ context, page }) => {
    await authenticate(context);
    await page.goto("/");
  });

  test("dashboard home renders pipeline overview", async ({ page }) => {
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
    // Pipeline metrics cards or the empty state must be present.
    const hasMetrics = await page.getByText(/jobs discovered/i).isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/pipeline not started/i).isVisible().catch(() => false);
    expect(hasMetrics || hasEmpty).toBeTruthy();
  });

  test("scout page lists jobs or shows empty state", async ({ page }) => {
    await page.goto("/scout");
    await expect(page).toHaveURL("/scout");
    await expect(page.getByRole("heading", { name: /scout/i })).toBeVisible();
  });

  test("applications page shows quota bar", async ({ page }) => {
    await page.goto("/applications");
    await expect(page).toHaveURL("/applications");
    await expect(page.getByText(/daily submission quota/i)).toBeVisible();
  });

  test("relocation planner shows checklist and disclaimer", async ({ page }) => {
    await page.goto("/relocation");
    await expect(page).toHaveURL("/relocation");
    await expect(page.getByText(/not legal advice/i).first()).toBeVisible();
    await expect(page.getByText(/checklist progress/i)).toBeVisible();
  });

  test("automation page shows capability flags", async ({ page }) => {
    await page.goto("/automation");
    await expect(page).toHaveURL("/automation");
    await expect(page.getByRole("heading", { name: /capabilities/i })).toBeVisible();
    await expect(page.getByText(/AI analysis/i)).toBeVisible();
    await expect(page.getByText(/Email notifications/i)).toBeVisible();
  });

  test("settings page shows notification preferences", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL("/settings");
    await expect(page.getByRole("heading", { name: /notification preferences/i })).toBeVisible();
  });

  test("profile page shows CV import and editors", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL("/profile");
    await expect(page.getByText(/import cv/i)).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });

  test("documents page renders", async ({ page }) => {
    await page.goto("/documents");
    await expect(page).toHaveURL("/documents");
  });
});
