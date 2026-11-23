import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Veriler build sırasında değil istek anında veritabanından okunur (Docker build'de DB yoktur);
  // önbellekleme unstable_cache + etiketlerle yapılır. Bu yüzden Cache Components kapalı.
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.oraclecloud.com" },
      { protocol: "https", hostname: "**.oraclecloudstorage.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
