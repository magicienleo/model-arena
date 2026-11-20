import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ÉduPilot — Caisse des Écoles",
    short_name: "ÉduPilot",
    description: "Pilotage intelligent et IA supervisée pour les Caisses des Écoles de Martinique",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f6f8fc",
    theme_color: "#112144",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
