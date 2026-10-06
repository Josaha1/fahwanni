import type { NextConfig } from "next";
import { APP_VERSION } from "./src/lib/version";

// Identifies this build so installed apps can notice a newer deploy and reload (see version-watcher).
const buildId = `${APP_VERSION}-${process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`}`;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  headers: async () => [
    { source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
  ],
  redirects: async () => [
    { source: "/water/dam/:id", destination: "/dam/:id", permanent: true },
    // The map-first home replaced these pages; query strings (map position, layers) pass through.
    { source: "/water", destination: "/?lens=dams", permanent: true },
    { source: "/rain", destination: "/?lens=rain", permanent: true },
    { source: "/map", destination: "/", permanent: true },
  ],
};

export default nextConfig;
