import { describe, expect, it } from "vitest";
import { createErrorRateLimiter, sanitizeErrorMessage } from "./error-log";

describe("error log helpers", () => {
  it("removes URLs, email, coordinates and long numbers before logging", () => {
    expect(sanitizeErrorMessage("at https://site.test/a?token=secret me@site.test 13.756331,100.501765 0812345678"))
      .toBe("at [url] [email] #,# #");
    expect(sanitizeErrorMessage("x".repeat(350))).toHaveLength(300);
  });

  it("allows ten reports per key and resets after a minute", () => {
    const allow = createErrorRateLimiter();
    for (let i = 0; i < 10; i++) expect(allow("a", 1000)).toBe(true);
    expect(allow("a", 1000)).toBe(false);
    expect(allow("b", 1000)).toBe(true);
    expect(allow("a", 61_000)).toBe(true);
  });
});
