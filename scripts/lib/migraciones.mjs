// Que archivos de migracion hay que aplicar y en que orden.
//
// Lo usan los dos corredores: `scripts/migrar.mjs` (Postgres de verdad, por red) y
// `scripts/local.mjs` (Postgres embebido, modo local). La lista tiene que ser la misma
// en los dos: si no, una instancia local y una desplegada tendrian esquemas distintos y
// el modo local dejaria de servir para probar nada.
//
//   1. supabase/migrations/*.sql           (nucleo)
//   2. modules/<modulo>/migrations/*.sql   (solo modulos activos)

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function listarSql(dir, prefijo) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ nombre: `${prefijo}${f}`, ruta: join(dir, f) }));
}

/** Modulos activos segun config/modulos.json (la misma lista que lee config/cliente.ts). */
export function modulosActivos(raiz) {
  const archivo = join(raiz, "config", "modulos.json");
  if (!existsSync(archivo)) return [];
  try {
    const json = JSON.parse(readFileSync(archivo, "utf8"));
    const lista = Array.isArray(json?.activos) ? json.activos : [];
    return lista.filter((m) => typeof m === "string" && /^[a-z][a-z0-9_]*$/.test(m));
  } catch {
    return [];
  }
}

/** `[{ nombre, ruta }]` en orden de aplicacion. */
export function listarMigraciones(raiz) {
  return [
    ...listarSql(join(raiz, "supabase", "migrations"), ""),
    ...modulosActivos(raiz).flatMap((m) =>
      listarSql(join(raiz, "modules", m, "migrations"), `modules/${m}/`)
    ),
  ];
}
