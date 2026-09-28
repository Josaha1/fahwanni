import type { NextConfig } from "next";

// Identifies this build so installed apps can notice a newer deploy and reload (see version-watcher).
const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
};

export default nextConfig;
