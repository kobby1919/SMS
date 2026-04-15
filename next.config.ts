import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["images.pexels.com"],
  },
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/client"],
};

export default nextConfig;