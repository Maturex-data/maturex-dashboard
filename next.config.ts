import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws", "@neondatabase/serverless"],
  async redirects() {
    return [
      {
        source: "/ecombius/drive-sync",
        destination: "/ecombius/bo-import",
        permanent: false,
      },
      {
        source: "/flowa/drive-sync",
        destination: "/ecombius/bo-import",
        permanent: false,
      },
      {
        source: "/ecombius/import",
        destination: "/ecombius/bo-import",
        permanent: false,
      },
      {
        source: "/flowa/import",
        destination: "/ecombius/bo-import",
        permanent: false,
      },
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
