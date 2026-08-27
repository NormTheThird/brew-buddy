import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      // Receipt photos come through server actions; default is 1 MB.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
