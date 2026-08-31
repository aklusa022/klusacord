import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allows the local browser-preview proxy (a different origin/port) to hit
  // dev-server Server Actions without Next.js rejecting the request.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
