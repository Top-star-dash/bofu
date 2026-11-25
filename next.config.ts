import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 允许手机等局域网设备通过本机 IP 访问开发资源（/_next/*） */
  allowedDevOrigins: [
    "192.168.31.88",
    "127.0.0.1",
    "localhost",
  ],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
