import type { NextConfig } from "next";
import path from "node:path";
import { readFileSync } from "node:fs";
import { generarRegistroModulos } from "./scripts/generar-registro-modulos.mjs";

const pkg = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as { version: string };

// Registro de modulos activos (config/modulos.json -> src/lib/modules/*.generated.ts).
// Se regenera aqui para que dev, build y la imagen Docker compilen los mismos modulos.
generarRegistroModulos(process.cwd());

const nextConfig: NextConfig = {
  // Standalone: la imagen Docker copia solo .next/standalone + static + public.
  // En Windows se desactiva porque el trazado usa symlinks que ahi fallan.
  output: process.platform === "win32" ? undefined : "standalone",
  // `postgres` es el driver de produccion. `@electric-sql/pglite` es el Postgres
  // embebido del modo local y tiene que quedar fuera del bundle si o si: resuelve sus
  // extensiones a partir de la ruta de su propio archivo, y el compilador la reescribe
  // a un marcador (`file:///ROOT/...`) con el que no encuentra nada.
  serverExternalPackages: ["postgres", "@electric-sql/pglite"],
  turbopack: {
    root: path.resolve("."),
  },
  env: {
    // Version congelada al construir; commit solo si el build lo recibio (SOURCE_COMMIT).
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_COMMIT: process.env.SOURCE_COMMIT ?? "",
  },
};

export default nextConfig;
