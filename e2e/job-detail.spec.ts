import { test, expect } from "@playwright/test";
import { authenticate } from "./helpers/auth";

/**
 * E2E: job detail page + AI analysis panel behaviour.
 */
test.describe("Job detail", () => {
  test.beforeEach(async ({ context }) => {
    await authenticate(context);
  });

  test("unknown job returns 404", async ({ page }) => {
    await page.goto("/scout/nonexistent-job-id");
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("existing job renders detail + AI panel + score panel", async ({ page }) => {
    // The seeded test job from earlier smoke tests.
    await page.goto("/scout/mock-ats__test-job-1");
    await expect(page.getByRole("heading", { name: /senior frontend engineer/i })).toBeVisible();
    await expect(page.getByText("TestCo BV · Amsterdam")).toBeVisible();
    // Application kit (packet + standard answers)
    await expect(page.getByRole("heading", { name: /application kit/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /download packet/i })).toBeVisible();
    // AI analysis panel present
    await expect(page.getByRole("heading", { name: /ai analysis/i })).toBeVisible();
    // Job actions (record application)
    await expect(page.getByRole("button", { name: /i applied/i })).toBeVisible();
    // Application documents
    await expect(page.getByRole("heading", { name: /application documents/i })).toBeVisible();
  });

  test("AI analysis button triggers analysis or shows unavailable reason", async ({ page }) => {
    await page.goto("/scout/mock-ats__test-job-1");
    const runBtn = page.getByRole("button", { name: /run ai analysis/i });
    await expect(runBtn).toBeVisible();
    await runBtn.click();
    // Either an analysis result or an unavailability message must appear.
    const analysis = page.getByText(/match reasons|summary/i);
    const unavailable = page.getByText(/not configured|high demand|AI provider/i);
    await expect(analysis.or(unavailable)).toBeVisible({ timeout: 60_000 });
  });
});
