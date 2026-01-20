import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // ⚠️ Disable React StrictMode in development (callbacks won't run twice)
  // Note: StrictMode helps catch bugs - only disable if necessary
  reactStrictMode: false,

  // Remove console.log in production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Use empty turbopack config to silence the warning and continue using webpack
  turbopack: {},
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's2.coinmarketcap.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'prod.spline.design',
      },
    ],
  },
  // ✅ Allow loading Spline 3D models from external CDN
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
  // ✅ Removed Noir packages to enable client-side proof generation
  // If you need server-only packages, add them here
  serverExternalPackages: [
    // '@aztec/bb.js',  // ← Now available in client
    // '@noir-lang/backend_barretenberg',  // ← Now available in client
    // '@noir-lang/noir_js',  // ← Now available in client
  ],
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/wasm/[name].[hash][ext]',
      },
    });

    // config.resolve.alias = {
    //   ...config.resolve.alias,
    //   '@aztec/bb.js': path.resolve(__dirname, 'node_modules/@aztec/bb.js'),
    // };

    // Fallback for node modules that might not be available in the browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;
