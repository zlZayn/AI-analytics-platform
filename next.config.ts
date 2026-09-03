import type { NextConfig } from "next";
import packageMetadata from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageMetadata.version,
  },
  turbopack: {
    root: __dirname,
  },
  // Cross-Origin Isolation：WebR 的 SharedArrayBuffer 通道需要 COOP/COEP。
  // 项目字体已自托管、无第三方 CDN 资源，require-corp 破坏面≈0。
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
