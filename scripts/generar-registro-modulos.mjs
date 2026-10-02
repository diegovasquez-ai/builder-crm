#!/usr/bin/env node
// Genera el registro de modulos activos con imports ESTATICOS, para que el bundler
// (Turbopack o webpack) los compile. Lee config/modulos.json y escribe:
//
//   src/lib/modules/registro.generated.ts          (servidor: paginas, api, tools, seed)
//   src/lib/modules/registro-cliente.generated.ts  (navegador: nav, campos)
//
// Lo invoca next.config.ts al cargar (dev, build y Docker) y `npm run typecheck`.
// Es idempotente: no reescribe si el contenido no cambio (evita reinicios en dev).
//
//   node scripts/generar-registro-modulos.mjs

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function leerModulosActivos(raiz) {
  const archivo = join(raiz, "config", "modulos.json");
  if (!existsSync(archivo)) return [];
  const json = JSON.parse(readFileSync(archivo, "utf8"));
  const lista = Array.isArray(json?.activos) ? json.activos : [];
  const validos = [];
  for (const nombre of lista) {
    if (typeof nombre !== "string" || !/^[a-z][a-z0-9_]*$/.test(nombre)) {
      throw new Error(`config/modulos.json: nombre de modulo invalido "${nombre}" (snake_case, sin guion bajo inicial)`);
    }
    const carpeta = join(raiz, "modules", nombre);
    for (const req of ["manifiesto", "servidor"]) {
      if (!existsSync(join(carpeta, `${req}.ts`)) && !existsSync(join(carpeta, `${req}.tsx`))) {
        throw new Error(`config/modulos.json: el modulo "${nombre}" no tiene modules/${nombre}/${req}.ts(x)`);
      }
    }
    if (!validos.includes(nombre)) validos.push(nombre);
  }
  return validos;
}

function escribirSiCambio(ruta, contenido) {
  const actual = existsSync(ruta) ? readFileSync(ruta, "utf8") : null;
  if (actual === contenido) return false;
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, contenido, "utf8");
  return true;
}

export function generarRegistroModulos(raiz) {
  const activos = leerModulosActivos(raiz);
  const cabecera = "// GENERADO por scripts/generar-registro-modulos.mjs a partir de config/modulos.json.\n// No editar a mano: se reescribe al arrancar y al construir.\n";

  const servidor =
    cabecera +
    'import type { ModuloServidor } from "./types";\n' +
    activos.map((m) => `import s_${m} from "@modules/${m}/servidor";\n`).join("") +
    "\nexport const MODULOS_SERVIDOR: Record<string, ModuloServidor> = {\n" +
    activos.map((m) => `  ${m}: s_${m},\n`).join("") +
    "};\n";

  const cliente =
    cabecera +
    'import type { ManifiestoModulo } from "./types";\n' +
    activos.map((m) => `import m_${m} from "@modules/${m}/manifiesto";\n`).join("") +
    "\nexport const MANIFIESTOS: ManifiestoModulo[] = [" +
    activos.map((m) => `m_${m}`).join(", ") +
    "];\n";

  const dir = join(raiz, "src", "lib", "modules");
  const a = escribirSiCambio(join(dir, "registro.generated.ts"), servidor);
  const b = escribirSiCambio(join(dir, "registro-cliente.generated.ts"), cliente);
  return { activos, cambio: a || b };
}

const esPrincipal = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (esPrincipal) {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
  const r = generarRegistroModulos(raiz);
  console.log(`[modulos] activos: ${r.activos.length ? r.activos.join(", ") : "(ninguno)"}${r.cambio ? " (registro actualizado)" : ""}`);
}
