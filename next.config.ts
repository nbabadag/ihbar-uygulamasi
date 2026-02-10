import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // eslint kısmını sildik çünkü loglarda uyarı veriyordu
  // Turbopack ayarlarını Next.js otomatik halleder
};

export default nextConfig;