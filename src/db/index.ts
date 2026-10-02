import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

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
 */

type BaseDeDatos = ReturnType<typeof crearCliente>;

function crearCliente() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no esta seteada. Configurala en .env.local (Supabase: Settings -> Database -> Connection string)."
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

let instancia: BaseDeDatos | null = null;

function obtenerCliente(): BaseDeDatos {
  instancia ??= crearCliente();
  return instancia;
}

export const db = new Proxy({} as BaseDeDatos, {
  get(_destino, propiedad) {
    const real = obtenerCliente() as unknown as Record<string | symbol, unknown>;
    const valor = real[propiedad];
    return typeof valor === "function" ? valor.bind(real) : valor;
  },
  has(_destino, propiedad) {
    return propiedad in (obtenerCliente() as object);
  },
});
