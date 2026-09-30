import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const payload = { message: "failed at 13.756331", digest: "abc", path: "/map", kind: "route", ts: 1 };
const request = (body: unknown, ip = "192.0.2.1") => new Request("http://localhost/api/log", {
  method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body),
});

afterEach(() => vi.restoreAllMocks());

describe("POST /api/log", () => {
  it("logs one sanitized JSON line and returns 204", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(request(payload, "192.0.2.2"))).status).toBe(204);
    expect(log).toHaveBeenCalledWith(JSON.stringify({ ...payload, message: "failed at #" }));
  });

  it("rejects oversized, invalid and extra-field payloads", async () => {
    expect((await POST(request({ ...payload, message: "x".repeat(2049) }))).status).toBe(413);
    expect((await POST(request({ ...payload, path: "/map?q=secret" }))).status).toBe(400);
    expect((await POST(request({ ...payload, location: "home" }))).status).toBe(400);
  });

  it("limits each IP hash to ten reports per minute", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 10; i++) expect((await POST(request(payload, "192.0.2.3"))).status).toBe(204);
    expect((await POST(request(payload, "192.0.2.3"))).status).toBe(429);
    expect((await POST(request(payload, "192.0.2.4"))).status).toBe(204);
  });
});
