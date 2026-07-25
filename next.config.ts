import type { NextConfig } from "next";
import packageMetadata from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageMetadata.version,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
