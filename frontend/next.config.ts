import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    // More explicit alias configuration
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "src"),
      "@/lib": path.resolve(__dirname, "src/lib"),
      "@/app": path.resolve(__dirname, "src/app"),
      "@/components": path.resolve(__dirname, "src/components"),
    };

    // Increase memory limit for build
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: "all",
        cacheGroups: {
          default: false,
          vendors: false,
          vendor: {
            name: "vendor",
            chunks: "all",
            test: /node_modules/,
          },
        },
      },
    };

    // Add more explicit module resolution
    config.resolve.modules = [path.resolve(__dirname, "src"), "node_modules"];

    return config;
  },
  // Increase build timeout
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
