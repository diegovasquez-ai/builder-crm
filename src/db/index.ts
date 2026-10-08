import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createRequire } from "node:module";
import { join } from "node:path";
import * as schema from "./schema";
import { CARPETA_BASE_LOCAL, modoLocal } from "@/lib/modo-local";

/**
 * Cliente de base PEREZOSO.
 *
 * `next build` importa cada route handler para recolectar metadatos, asi que si este
 * modulo leyera DATABASE_URL al importarse, el build pediria credenciales de base. Y
 * no debe: en el Dockerfile solo las NEXT_PUBLIC_* son build args; DATABASE_URL es de
 * runtime, porque la base de cada instancia se conoce al desplegar, no al compilar.
 *
 * Por eso `db` es un proxy: la conexion se arma en el primer uso real. Si falta la
 * variable, el error salta ahi (con el mismo mensaje de siempre) y no durante el build.
 * El driver `postgres` tampoco abre socket hasta la primera consulta.
 *
 * En MODO LOCAL (ver src/lib/modo-local.ts) no hay base por red: se usa un Postgres
 * embebido guardado en `.local/db`. Es el mismo Postgres y las mismas migraciones, solo
 * que compilado a WebAssembly y corriendo dentro del proceso de Node.
 */

type BaseDeDatos = ReturnType<typeof crearCliente>;

/**
 * El paquete del Postgres embebido se carga a mano y solo si hace falta.
 *
 * Es una devDependency: no esta en la imagen de produccion y no debe entrar al bundle.
 * El nombre va en una variable a proposito, para que el compilador de Next no lo
 * resuelva en tiempo de build y lo arrastre.
 */
function crearClienteLocal() {
  const requerir = createRequire(import.meta.url);
  const nombrePglite = "@electric-sql/pglite";
  const nombreContrib = "@electric-sql/pglite/contrib/pgcrypto";
  const nombreDrizzle = "drizzle-orm/pglite";

  let PGlite: new (opciones: unknown) => unknown;
  let pgcrypto: unknown;
  let drizzleLocal: (cliente: unknown, opciones: unknown) => BaseDeDatos;
  try {
    ({ PGlite } = requerir(nombrePglite));
    ({ pgcrypto } = requerir(nombreContrib));
    ({ drizzle: drizzleLocal } = requerir(nombreDrizzle));
  } catch {
    throw new Error(
      "Modo local: falta el paquete del Postgres embebido. Corre `npm install` y volve a `npm run local`."
    );
  }

  const cliente = new PGlite({
    dataDir: join(process.cwd(), CARPETA_BASE_LOCAL),
    extensions: { pgcrypto },
  });
  return drizzleLocal(cliente, { schema });
}

function crearCliente() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no esta seteada. Configurala en .env.local (Supabase: Settings -> Database -> Connection string).\n" +
        "Para probar el CRM sin crear nada: npm run local"
    );
  }

  const client = postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(client, { schema });
}

/**
 * En modo local la instancia vive en globalThis. `next dev` recarga los modulos en
 * caliente y la base embebida es un archivo con un solo dueno: una segunda instancia
 * sobre la misma carpeta no abre.
 */
const almacen = globalThis as unknown as { __dbBuilderCrm?: BaseDeDatos };
let instancia: BaseDeDatos | null = null;

function obtenerCliente(): BaseDeDatos {
  if (modoLocal()) {
    almacen.__dbBuilderCrm ??= crearClienteLocal();
    return almacen.__dbBuilderCrm;
  }
  instancia ??= crearCliente();
  return instancia;
}

/**
 * `db.execute(sql...)` devuelve cosas distintas segun el driver: `postgres` devuelve el
 * array de filas y el embebido devuelve `{ rows, fields }`. Media docena de lugares
 * (reportes, equipo, automatizaciones, seed) hacen `resultado[0]` sobre eso.
 *
 * Si no se normalizara, en modo local no se rompe nada a la vista: las consultas crudas
 * devolverian `undefined` y los reportes saldrian en cero, sin un solo error. Por eso se
 * iguala aca y no en cada lugar que lo usa.
 */
function normalizarExecute(real: Record<string | symbol, unknown>) {
  const original = real.execute as (...args: unknown[]) => Promise<unknown>;
  return async (...args: unknown[]) => {
    const resultado = (await original.apply(real, args)) as { rows?: unknown[] };
    return Array.isArray(resultado) ? resultado : (resultado?.rows ?? []);
  };
}

export const db = new Proxy({} as BaseDeDatos, {
  get(_destino, propiedad) {
    const real = obtenerCliente() as unknown as Record<string | symbol, unknown>;
    if (propiedad === "execute" && modoLocal()) return normalizarExecute(real);
    const valor = real[propiedad];
    return typeof valor === "function" ? valor.bind(real) : valor;
  },
  has(_destino, propiedad) {
    return propiedad in (obtenerCliente() as object);
  },
});
