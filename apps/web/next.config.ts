import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@keeplas/ui", "@keeplas/backend"],
};

export default nextConfig;
