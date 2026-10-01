import "server-only";

import { request } from "node:https";
import { rootCertificates } from "node:tls";

/** GET JSON over https with extra CA certificates added to Node's default roots (verification stays on). */
export function fetchJsonWithCa(url: string, extraCa: string[], timeoutMs = 30_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET", ca: [...rootCertificates, ...extraCa], timeout: timeoutMs,
      headers: { "User-Agent": "fahwanni/1.0 (https://fahwanni.vercel.app)", Accept: "application/json" } }, (response) => {
      if ((response.statusCode ?? 0) < 200 || (response.statusCode ?? 0) >= 300) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (error) { reject(error); }
      });
      response.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}
