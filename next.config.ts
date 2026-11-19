import type { NextConfig } from "next";

const nextConfig: NextConfig =
  process.env.ELAT_STANDALONE === "1" ? { output: "standalone" } : {};

export default nextConfig;
