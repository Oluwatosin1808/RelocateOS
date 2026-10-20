import { describe, it, expect } from "vitest";
import { buildChecklist, buildBudgetEstimates, getRelocationDisclaimer } from "@domain/relocation/planner";

describe("buildChecklist", () => {
  it("returns items for NL", () => {
    const items = buildChecklist("NL");
    expect(items.length).toBeGreaterThan(0);
  });
  it("returns items for BE", () => {
    const items = buildChecklist("BE");
    expect(items.length).toBeGreaterThan(0);
  });
  it("NL checklist includes recognised-sponsor item", () => {
    const items = buildChecklist("NL");
    expect(items.some((i) => i.id.includes("sponsor"))).toBe(true);
  });
  it("every item has an id and category", () => {
    for (const item of buildChecklist("NL")) {
      expect(item.id).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.title).toBeTruthy();
    }
  });
  it("official items link to a URL", () => {
    for (const item of buildChecklist("NL")) {
      if (item.source === "official") {
        expect(item.url).toMatch(/^https:\/\//);
      }
    }
  });
  it("starts all items incomplete", () => {
    for (const item of buildChecklist("NL")) {
      expect(item.completed).toBe(false);
      expect(item.completedAt).toBeNull();
    }
  });
});

describe("buildBudgetEstimates", () => {
  it("returns budget rows for NL", () => {
    const budget = buildBudgetEstimates("NL");
    expect(budget.length).toBeGreaterThan(0);
  });
  it("returns budget rows for BE", () => {
    const budget = buildBudgetEstimates("BE");
    expect(budget.length).toBeGreaterThan(0);
  });
  it("low <= high for every row", () => {
    for (const b of buildBudgetEstimates("NL")) {
      expect(b.lowEur).toBeLessThanOrEqual(b.highEur);
    }
  });
  it("labelled as estimate", () => {
    for (const b of buildBudgetEstimates("BE")) {
      expect(b.source).toBe("estimate");
    }
  });
});

describe("getRelocationDisclaimer", () => {
  it("NL disclaimer mentions IND", () => {
    expect(getRelocationDisclaimer("NL")).toContain("IND");
  });
  it("BE disclaimer exists", () => {
    expect(getRelocationDisclaimer("BE").length).toBeGreaterThan(0);
  });
  it("states not legal advice", () => {
    expect(getRelocationDisclaimer("NL")).toContain("not legal advice");
  });
});
