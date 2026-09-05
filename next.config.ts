import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Version: major.minor is set by hand when a milestone ships (1.0 = the
// first production release, Sep 2026); the build number is the git commit
// count, so every deploy bumps it without anyone remembering to.
const VERSION_BASE = "1.0";
function buildNumber(): string {
  try {
    return execSync("git rev-list --count HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "0";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: `${VERSION_BASE}.${buildNumber()}`,
  },
  output: "standalone",
  // Pin the tracing root to THIS project: without it Next guesses a
  // workspace root above the repo and nests the standalone output
  // (.next/standalone/_github/.../server.js), breaking the Dockerfile COPY.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      // Receipt photos come through server actions; default is 1 MB.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
