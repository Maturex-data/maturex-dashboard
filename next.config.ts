import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws", "@neondatabase/serverless"],
  async redirects() {
    return [
      {
        source: "/flowa",
        destination: "/ecombius",
        permanent: false,
      },
      {
        source: "/flowa/:path*",
        destination: "/ecombius/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
