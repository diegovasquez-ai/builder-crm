import { z } from "zod";
import { MANIFIESTOS } from "./registro-cliente.generated";
import { esquemaCampo, type CampoConfig } from "@/lib/config/schema";
import type { ManifiestoModulo, ItemNavModulo } from "./types";

/**
 * Lado navegador del sistema de modulos: solo manifiestos (nav, campos). Lo usan el
 * sidebar y la configuracion. Nada de aqui toca la base de datos.
 */

export function manifiestosActivos(): ManifiestoModulo[] {
  return MANIFIESTOS;
}

export interface EntradaNavModulo extends ItemNavModulo {
  href: string;
  modulo: string;
}

export function navModulos(): EntradaNavModulo[] {
  return MANIFIESTOS.flatMap((m) =>
    (m.nav ?? []).map((item) => ({
      ...item,
      modulo: m.nombre,
      href: item.ruta ? `/m/${m.nombre}/${item.ruta.replace(/^\/+/, "")}` : `/m/${m.nombre}`,
    }))
  );
}

let camposCache: CampoConfig[] | null = null;
let erroresCache: string[] | null = null;

function parsearCampos() {
  if (camposCache && erroresCache) return;
  const campos: CampoConfig[] = [];
  const errores: string[] = [];
  for (const m of MANIFIESTOS) {
    const r = z.array(esquemaCampo).safeParse(m.campos ?? []);
    if (r.success) campos.push(...r.data);
    else errores.push(...r.error.issues.map((i) => `modulo ${m.nombre}, campos.${i.path.join(".")}: ${i.message}`));
  }
  camposCache = campos;
  erroresCache = errores;
}

/** Campos de contacto aportados por los modulos activos (ya validados). */
export function camposDeModulos(): CampoConfig[] {
  parsearCampos();
  return camposCache ?? [];
}

/** Problemas en los manifiestos de los modulos activos (vacio si todo esta bien). */
export function erroresDeModulos(): string[] {
  parsearCampos();
  return erroresCache ?? [];
}
