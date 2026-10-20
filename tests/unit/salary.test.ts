import { describe, expect, it } from "vitest";
import { parseSalary, detectCurrency } from "@domain/jobs/salary";

describe("parseSalary", () => {
  it("parses a monthly EUR range", () => {
    const s = parseSalary("€3,000 – €4,500 per month");
    expect(s.min).toBe(3000);
    expect(s.max).toBe(4500);
    expect(s.currency).toBe("EUR");
    expect(s.period).toBe("monthly");
    expect(s.monthlyEurMin).toBe(3000);
    expect(s.monthlyEurMax).toBe(4500);
  });

  it("converts annual EUR to monthly", () => {
    const s = parseSalary("€60,000 - €72,000 annual");
    expect(s.min).toBe(60000);
    expect(s.period).toBe("annual");
    expect(s.monthlyEurMin).toBe(5000);
    expect(s.monthlyEurMax).toBe(6000);
  });

  it("handles EU number formatting", () => {
    const s = parseSalary("€4.500 - €5.500 p.m.");
    expect(s.min).toBe(4500);
    expect(s.max).toBe(5500);
    expect(s.monthlyEurMin).toBe(4500);
  });

  it("handles k notation", () => {
    const s = parseSalary("€55k - €65k per year");
    expect(s.min).toBe(55000);
    expect(s.max).toBe(65000);
    expect(s.monthlyEurMin).toBeCloseTo(4583, 0);
  });

  it("returns unknown for empty or non-numeric text", () => {
    expect(parseSalary("").min).toBeNull();
    expect(parseSalary("competitive salary").min).toBeNull();
    expect(parseSalary("competitive salary").period).toBe("unknown");
  });

  it("does not guess a monthly EUR value for unknown currency", () => {
    const s = parseSalary("₹50,000 - ₹70,000 per month");
    expect(s.min).toBe(50000);
    expect(s.monthlyEurMin).toBeNull();
  });

  it("detects currency tokens", () => {
    expect(detectCurrency("EUR 3000")).toBe("EUR");
    expect(detectCurrency("$3,000")).toBe("USD");
    expect(detectCurrency("no money here")).toBeNull();
  });
});
