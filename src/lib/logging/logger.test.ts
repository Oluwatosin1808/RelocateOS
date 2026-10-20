import { describe, expect, it } from "vitest";
import { redactFields, redactValue, createLogger } from "@/lib/logging/logger";

describe("redactValue", () => {
  it("redacts values whose key looks like a secret", () => {
    expect(redactValue("sk-123", "apiKey")).toBe("[redacted]");
    expect(redactValue("hunter2", "password")).toBe("[redacted]");
    expect(redactValue("abc", "authorization")).toBe("[redacted]");
  });

  it("redacts emails inside strings", () => {
    expect(redactValue("contact me at jane.doe@example.com today")).toBe(
      "contact me at [redacted] today",
    );
  });

  it("recursively redacts nested objects", () => {
    const out = redactValue({
      user: { email: "a@b.com", name: "Ada" },
      token: "secret-value",
      nested: { apiKey: "k" },
    }) as Record<string, unknown>;
    expect(out.token).toBe("[redacted]");
    expect((out.user as Record<string, unknown>).email).toBe("[redacted]");
    expect((out.user as Record<string, unknown>).name).toBe("Ada");
    expect((out.nested as Record<string, unknown>).apiKey).toBe("[redacted]");
  });

  it("leaves ordinary values alone", () => {
    expect(redactValue("job-scan started")).toBe("job-scan started");
    expect(redactValue(42)).toBe(42);
    expect(redactValue(null)).toBe(null);
  });
});

describe("redactFields", () => {
  it("applies key-based redaction at the top level", () => {
    const out = redactFields({ jobId: "abc", privateKey: "pem", count: 3 });
    expect(out).toEqual({ jobId: "abc", privateKey: "[redacted]", count: 3 });
  });
});

describe("createLogger", () => {
  it("emits JSON lines with bindings and redaction", () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (line: string) => lines.push(line);
    try {
      const log = createLogger({ module: "test" });
      log.info("hello", { apiKey: "secret", jobId: "j1" });
    } finally {
      console.log = orig;
    }
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(parsed.module).toBe("test");
    expect(parsed.apiKey).toBe("[redacted]");
    expect(parsed.jobId).toBe("j1");
    expect(typeof parsed.time).toBe("string");
  });
});
