import "server-only";

/**
 * Que formas de entrar admite esta instancia.
 *
 * No se configura dos veces: en lugar de una variable propia del CRM, se le pregunta al
 * proveedor de autenticacion por su endpoint publico `/auth/v1/settings`, que devuelve
 * los proveedores externos encendidos. Asi, encender Google es poner sus variables en
 * GoTrue (o el interruptor en el panel de Supabase cloud) y nada mas: el boton aparece
 * solo, y si no esta configurado no aparece.
 *
 * Falla cerrado: si la consulta no responde, se devuelve lista vacia y queda solo el
 * acceso por email y contrasena, que no depende de esto.
 */

export type ProveedorExterno = "google" | "github" | "azure" | "facebook" | "apple";

const CONOCIDOS: ProveedorExterno[] = ["google", "github", "azure", "facebook", "apple"];

export async function proveedoresExternos(): Promise<ProveedorExterno[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return [];

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: anon },
      // La configuracion del proveedor no cambia cada minuto, y esto corre en cada
      // carga del login: se cachea cinco minutos.
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const datos = (await res.json()) as { external?: Record<string, boolean> };
    const externos = datos.external ?? {};
    return CONOCIDOS.filter((p) => externos[p] === true);
  } catch {
    return [];
  }
}

/** Nombre para mostrar en el boton. */
export const NOMBRE_PROVEEDOR: Record<ProveedorExterno, string> = {
  google: "Google",
  github: "GitHub",
  azure: "Microsoft",
  facebook: "Facebook",
  apple: "Apple",
};
