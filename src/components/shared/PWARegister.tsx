"use client";

import { useEffect } from "react";

/**
 * Registra el service worker. Va en el layout raiz para que corra en toda pagina.
 *
 * Se usa la URL absoluta con `window.location.origin`: iOS rechaza el registro si
 * el scope no coincide exactamente con el origen.
 */
export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker
      .register(`${window.location.origin}/sw.js`, { scope: "/" })
      .then((registration) => {
        if (cancelled) return;
        // Cada hora se busca una version nueva del worker, por si cambio el deploy.
        const timer = setInterval(() => registration.update(), 60 * 60 * 1000);
        return () => clearInterval(timer);
      })
      .catch((err) => {
        console.warn("[pwa] no se pudo registrar el service worker", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
