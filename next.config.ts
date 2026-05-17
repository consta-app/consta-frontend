import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // javascript-opentimestamps imports request/tunnel-agent which try to load
  // Node-only modules (fs/net/tls). They're never reached on the browser code
  // path we use (only OTS verification, not stamping), so we alias them away.
  turbopack: {
    resolveAlias: {
      fs: { browser: "./lib/empty-module.js" },
      net: { browser: "./lib/empty-module.js" },
      tls: { browser: "./lib/empty-module.js" },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
