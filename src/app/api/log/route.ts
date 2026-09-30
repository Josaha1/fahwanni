import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createErrorRateLimiter, sanitizeErrorMessage } from "@/lib/error-log";

const schema = z.strictObject({
  message: z.string().max(300),
  digest: z.string().max(100).optional(),
  path: z.string().max(500).startsWith("/").refine((path) => !/[?#]/.test(path)),
  kind: z.enum(["route", "global"]),
  ts: z.number().int().nonnegative(),
});
const salt = randomBytes(32);
const allow = createErrorRateLimiter();
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 2048) return new Response(null, { status: 413, headers });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400, headers });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) {
      await reader.cancel();
      return new Response(null, { status: 413, headers });
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return new Response(null, { status: 400, headers });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400, headers });

  const ipHash = createHash("sha256").update(salt).update(request.headers.get("x-forwarded-for") ?? "unknown").digest("hex");
  if (!allow(ipHash, Date.now())) return new Response(null, { status: 429, headers });

  console.error(JSON.stringify({ ...parsed.data, message: sanitizeErrorMessage(parsed.data.message) }));
  return new Response(null, { status: 204, headers });
}
