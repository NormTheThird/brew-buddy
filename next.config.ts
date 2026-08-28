import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
