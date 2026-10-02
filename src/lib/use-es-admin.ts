"use client";

import { useEffect, useState } from "react";

/**
 * Rol del miembro de la sesion, para mostrar u ocultar lo de admin en el navegador.
 * Es solo UI: el servidor vuelve a comprobar el rol en cada ruta.
 * null = todavia no se sabe.
 */
export function useEsAdmin(): boolean | null {
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    let activo = true;
    fetch("/api/team/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { member?: { role?: string } } | null) => {
        if (activo) setEsAdmin(data?.member?.role === "admin");
      })
      .catch(() => {
        if (activo) setEsAdmin(false);
      });
    return () => {
      activo = false;
    };
  }, []);
  return esAdmin;
}
