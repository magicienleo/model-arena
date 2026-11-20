import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le HTML est servi par le même processus Node : aucun service externe.
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Le serveur reste la seule source de vérité pour les données locales.
    serverActions: { bodySizeLimit: "8mb" },
  },
  images: { unoptimized: true },
};

export default nextConfig;
