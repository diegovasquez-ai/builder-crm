import type { MetadataRoute } from "next";
import { getConfig } from "@/lib/config";

/**
 * Manifest de la PWA, generado desde config/cliente.ts. Se sirve en
 * /manifest.webmanifest (el middleware lo deja pasar sin sesion: si fuera a /login el
 * navegador recibiria HTML y la app no se instalaria).
 *
 * Los iconos los genera `npm run pwa:icons` a partir de marca.icono.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { marca, idioma } = getConfig();
  return {
    name: marca.nombre,
    short_name: marca.nombreCorto,
    description: marca.descripcion,
    start_url: "/conversations",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: marca.colorSidebar,
    theme_color: marca.colorSidebar,
    lang: idioma,
    icons: [
      { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
      { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
      { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
      { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
