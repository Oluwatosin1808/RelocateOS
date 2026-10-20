import { test, expect } from "@playwright/test";
import { authenticate } from "./helpers/auth";

/**
 * E2E: API endpoints — auth guards, validation, and real data flows.
 */
test.describe("API endpoints", () => {
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    // Establish session via API (same flow as the UI helper).
    const { getIdToken } = await import("./helpers/auth");
    const idToken = await getIdToken();
    const res = await request.post("/api/auth/session", {
      data: { idToken },
    });
    expect(res.ok()).toBeTruthy();
    const setCookies = res.headers()["set-cookie"] ?? "";
    cookie = setCookies.split(";")[0] ?? "";
  });

  test("unauthenticated APIs return 401", async ({ request }) => {
    for (const path of ["/api/applications", "/api/notifications", "/api/analytics", "/api/relocation/plan"]) {
      const res = await request.get(path);
      expect(res.status(), `${path} should 401`).toBe(401);
    }
  });

  test("GET /api/analytics returns pipeline metrics", async ({ request }) => {
    const res = await request.get("/api/analytics", { headers: { Cookie: cookie } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.pipeline).toBeDefined();
    expect(typeof body.pipeline.discovered).toBe("number");
    expect(Array.isArray(body.statusBreakdown)).toBeTruthy();
  });

  test("GET /api/applications returns quota state", async ({ request }) => {
    const res = await request.get("/api/applications", { headers: { Cookie: cookie } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.applications)).toBeTruthy();
    expect(body.quota).toBeDefined();
    expect(typeof body.quota.limit).toBe("number");
  });

  test("GET /api/notifications returns list", async ({ request }) => {
    const res = await request.get("/api/notifications", { headers: { Cookie: cookie } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.notifications)).toBeTruthy();
  });

  test("GET /api/relocation/plan returns checklist", async ({ request }) => {
    const res = await request.get("/api/relocation/plan?country=NL", { headers: { Cookie: cookie } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.disclaimer).toContain("not legal advice");
  });

  test("POST /api/scout/scan triggers a scan", async ({ request }) => {
    const res = await request.post("/api/scout/scan", { headers: { Cookie: cookie } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.sourcesAttempted).toBe("number");
  });

  test("POST /api/profile accepts a valid profile update", async ({ request }) => {
    const res = await request.put("/api/profile", {
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      data: { profile: { professionalSummary: "E2E test summary — updated by Playwright." } },
    });
    expect(res.ok()).toBeTruthy();
  });

  test("POST /api/cron/scan rejects without secret", async ({ request }) => {
    const res = await request.post("/api/cron/scan");
    // 503 if SCHEDULER_SECRET unset, 401 if set but no/wrong secret provided.
    expect([401, 503]).toContain(res.status());
  });

  test("POST /api/cron/scan rejects wrong secret", async ({ request }) => {
    const res = await request.post("/api/cron/scan", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/documents/cv returns docx", async ({ request }) => {
    const res = await request.get("/api/documents/cv", { headers: { Cookie: cookie } });
    // May 422 if profile is incomplete — accept both 200 and 422 as valid.
    expect([200, 422]).toContain(res.status());
    if (res.status() === 200) {
      const contentType = res.headers()["content-type"] ?? "";
      expect(contentType).toContain("wordprocessingml");
    }
  });
});
