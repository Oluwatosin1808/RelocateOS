import { test, expect } from "@playwright/test";
import { authenticate } from "./helpers/auth";

/**
 * E2E: application lifecycle — create via job page, transition, quota.
 */
test.describe("Application lifecycle", () => {
  test.beforeEach(async ({ context }) => {
    await authenticate(context);
  });

  test("record application from job detail then see it in list", async ({ page }) => {
    // Open the seeded job.
    await page.goto("/scout/mock-ats__test-job-1");

    // Click "I applied — record it".
    const recordBtn = page.getByRole("button", { name: /i applied/i });
    await expect(recordBtn).toBeVisible();
    await recordBtn.click();

    // Should navigate to /applications.
    await expect(page).toHaveURL(/\/applications/, { timeout: 15_000 });

    // The job title should appear in the applications list (rendered as <p> in ApplicationRow).
    await expect(
      page.getByText(/senior frontend engineer/i).locator("visible=true").first(),
    ).toBeVisible({ timeout: 10_000 });

    // Quota bar shows usage.
    await expect(page.getByText(/daily submission quota/i)).toBeVisible();
  });

  test("applications page shows empty state or list", async ({ page }) => {
    await page.goto("/applications");
    await expect(page.getByText(/daily submission quota/i)).toBeVisible();
    const hasList = await page.getByText(/senior frontend engineer/i).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no applications yet/i).isVisible().catch(() => false);
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test("status filter links render", async ({ page }) => {
    await page.goto("/applications");
    // Filter chips should be present.
    await expect(page.getByRole("link", { name: /^all$/i })).toBeVisible();
  });
});
