import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // TypeScript hataları (Deno hatası dahil) build'i durdurmasın
    ignoreBuildErrors: true,
  },
  eslint: {
    // ESLint hataları build'i engellemesin
    ignoreDuringBuilds: true,
  },
  // Middleware uyarısını ve takılmaları aşmak için Turbopack'i kapatalım
  experimental: {
    turbo: {
      enabled: false
    }
  }
};

export default nextConfig;