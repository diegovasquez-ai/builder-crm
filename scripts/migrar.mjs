#!/usr/bin/env node
// Aplica las migraciones SQL pendientes sobre la base (Supabase Postgres).
//
//   node scripts/migrar.mjs            aplica lo pendiente
//   node scripts/migrar.mjs --status   lista aplicadas y pendientes, no toca nada
//   node scripts/migrar.mjs --dry-run  muestra lo que aplicaria
//
// Fuentes, en este orden:
//   1. supabase/migrations/*.sql           (nucleo)
//   2. modules/<modulo>/migrations/*.sql   (solo modulos activos; ver src/lib/modules)
//
// Cada archivo se aplica entero dentro de una transaccion y se registra en
// public._migraciones por nombre: o entra todo, o no entra nada, y una segunda corrida
// no lo vuelve a aplicar. Al final habilita RLS en cualquier tabla de `public` que no
// lo tenga (red de seguridad para tablas de modulos).
//
// Corre al arrancar el contenedor (docker/entrypoint.sh): si la base todavia no
// responde reintenta 15 veces cada 2 s antes de rendirse.
//
// Conexion: DIRECT_URL si existe (conexion directa, puerto 5432), si no DATABASE_URL.
// El pooler en modo transaccion tambien sirve: no se usan prepared statements.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { listarMigraciones } from "./lib/migraciones.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// En desarrollo las variables estan en .env.local; en el contenedor vienen del entorno.
// dotenv es devDependency: se carga solo si esta disponible.
if (!process.env.DATABASE_URL && existsSync(join(raiz, ".env.local"))) {
  try {
    const { config } = await import("dotenv");
    config({ path: join(raiz, ".env.local") });
  } catch {
    /* sin dotenv: el entorno ya tiene que traer DATABASE_URL */
  }
}

const args = new Set(process.argv.slice(2));
const soloEstado = args.has("--status");
const simulacion = args.has("--dry-run");

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("[migrar] falta DATABASE_URL (o DIRECT_URL). Revisa .env.example.");
  process.exit(1);
}

const archivos = listarMigraciones(raiz);

async function conectar() {
  const intentos = 15;
  for (let i = 1; i <= intentos; i++) {
    const sql = postgres(url, {
      prepare: false,
      max: 1,
      connect_timeout: 10,
      // Las migraciones usan RAISE NOTICE para contar lo que hicieron. Sin esto, el
      // driver imprime el objeto entero del aviso y parece que algo se rompio.
      onnotice: (aviso) => console.log(`[migrar] aviso: ${aviso.message}`),
    });
    try {
      await sql`select 1`;
      return sql;
    } catch (err) {
      await sql.end({ timeout: 1 }).catch(() => {});
      const msg = err instanceof Error ? err.message : String(err);
      if (i === intentos) {
        console.error(`[migrar] la base no responde tras ${intentos} intentos: ${msg}`);
        process.exit(1);
      }
      console.log(`[migrar] base no disponible (${msg}); reintento ${i}/${intentos} en 2 s`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("inalcanzable");
}

const sql = await conectar();

try {
  await sql`create table if not exists public._migraciones (
    nombre text primary key,
    aplicada_en timestamptz not null default now()
  )`;
  await sql`alter table public._migraciones enable row level security`;

  const aplicadas = new Set(
    (await sql`select nombre from public._migraciones`).map((r) => r.nombre)
  );
  const pendientes = archivos.filter((a) => !aplicadas.has(a.nombre));

  if (soloEstado || simulacion) {
    for (const a of archivos) {
      console.log(`${aplicadas.has(a.nombre) ? "aplicada " : "PENDIENTE"}  ${a.nombre}`);
    }
    console.log(`[migrar] ${aplicadas.size} aplicadas, ${pendientes.length} pendientes`);
  } else {
    for (const a of pendientes) {
      const contenido = readFileSync(a.ruta, "utf8");
      const inicio = Date.now();
      await sql.begin(async (tx) => {
        await tx.unsafe(contenido);
        await tx`insert into public._migraciones (nombre) values (${a.nombre})`;
      });
      console.log(`[migrar] aplicada ${a.nombre} (${Date.now() - inicio} ms)`);
    }
    if (pendientes.length === 0) console.log("[migrar] nada pendiente");

    // Red de seguridad: ninguna tabla de public sin RLS (cubre tablas de modulos).
    const sinRls = await sql`
      select c.relname as tabla
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    for (const { tabla } of sinRls) {
      await sql.unsafe(`alter table public."${tabla}" enable row level security`);
      console.log(`[migrar] RLS habilitado en ${tabla} (faltaba)`);
    }
    console.log(`[migrar] listo: ${aplicadas.size + pendientes.length} migraciones en total`);
  }
} catch (err) {
  const mensaje = err instanceof Error ? err.message : String(err);
  console.error("[migrar] fallo:", mensaje);
  // Los dos tropiezos de quien aloja su propio Postgres. En Supabase cloud no pasan
  // porque el esquema auth y auth.users ya vienen hechos.
  if (/schema "auth" does not exist/i.test(mensaje)) {
    console.error("[migrar] La base no tiene el esquema auth.");
    console.error("[migrar] Si es Supabase cloud, la URL no apunta a ese proyecto.");
    console.error("[migrar] Si es tu propio Postgres: npm run auth:preparar (docs/SUPABASE-EN-VPS.md).");
  } else if (/relation "auth\.users" does not exist/i.test(mensaje)) {
    console.error("[migrar] El esquema auth existe pero todavia no hay auth.users.");
    console.error("[migrar] Eso lo crea GoTrue la primera vez que arranca: levanta el");
    console.error("[migrar] contenedor de autenticacion y volve a correr esto");
    console.error("[migrar] (docs/SUPABASE-EN-VPS.md: el paso 3 va antes del 4).");
  }
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
