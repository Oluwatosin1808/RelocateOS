import { describe, it, expect } from "vitest";
import {
  utcDayKey,
  checkQuota,
  canTransition,
  findExistingApplication,
} from "@domain/applications/quota";
import type { Application } from "@domain/schemas/application";

function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: "a1",
    uid: "u1",
    jobId: "j1",
    jobTitle: "Frontend Engineer",
    employerName: "Acme",
    country: "NL",
    status: "submitted",
    methodUsed: "external_apply",
    notes: "",
    submissionReceipt: null,
    externalConfirmedAt: null,
    outcome: "",
    quotaDay: "2026-10-19",
    createdAt: "2026-10-19T10:00:00.000Z",
    updatedAt: "2026-10-19T10:00:00.000Z",
    ...overrides,
  };
}

describe("utcDayKey", () => {
  it("returns YYYY-MM-DD", () => {
    expect(utcDayKey(new Date("2026-10-19T10:30:00Z"))).toBe("2026-10-19");
  });
  it("is UTC not local", () => {
    expect(utcDayKey(new Date("2026-10-19T23:59:59Z"))).toBe("2026-10-19");
    expect(utcDayKey(new Date("2026-10-20T00:00:00Z"))).toBe("2026-10-20");
  });
});

describe("checkQuota", () => {
  it("allows when under limit", () => {
    const r = checkQuota(3, 10);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(7);
  });
  it("blocks when at limit", () => {
    const r = checkQuota(10, 10);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });
  it("blocks when over limit", () => {
    expect(checkQuota(11, 10).allowed).toBe(false);
  });
  it("allows when limit is 0 and used is 0", () => {
    expect(checkQuota(0, 0).allowed).toBe(false);
  });
  it("handles negative used as 0", () => {
    const r = checkQuota(-1, 5);
    expect(r.allowed).toBe(true);
    expect(r.used).toBe(-1);
  });
});

describe("canTransition", () => {
  it("allows draft -> queued", () => {
    expect(canTransition("draft", "queued")).toBe(true);
  });
  it("allows draft -> external_confirmed", () => {
    expect(canTransition("draft", "external_confirmed")).toBe(true);
  });
  it("allows submitted -> interview", () => {
    expect(canTransition("submitted", "interview")).toBe(true);
  });
  it("allows interview -> offer", () => {
    expect(canTransition("interview", "offer")).toBe(true);
  });
  it("allows interview -> rejected", () => {
    expect(canTransition("interview", "rejected")).toBe(true);
  });
  it("blocks offer -> interview (no backward)", () => {
    expect(canTransition("offer", "interview")).toBe(false);
  });
  it("blocks rejected -> anything", () => {
    expect(canTransition("rejected", "offer")).toBe(false);
  });
  it("blocks withdrawn -> anything", () => {
    expect(canTransition("withdrawn", "submitted")).toBe(false);
  });
  it("same status is a no-op success", () => {
    expect(canTransition("submitted", "submitted")).toBe(true);
  });
});

describe("findExistingApplication", () => {
  it("finds an active application for the job", () => {
    const apps = [makeApp({ jobId: "j1", status: "submitted" })];
    expect(findExistingApplication(apps, "j1")).toBeDefined();
  });
  it("ignores withdrawn applications", () => {
    const apps = [makeApp({ jobId: "j1", status: "withdrawn" })];
    expect(findExistingApplication(apps, "j1")).toBeUndefined();
  });
  it("ignores rejected applications", () => {
    const apps = [makeApp({ jobId: "j1", status: "rejected" })];
    expect(findExistingApplication(apps, "j1")).toBeUndefined();
  });
  it("returns undefined when no match", () => {
    expect(findExistingApplication([], "j1")).toBeUndefined();
  });
});
