#!/usr/bin/env node
// ============================================================================
// Builder CRM - correrlo en tu PC sin crear una cuenta en ningun lado
// ============================================================================
//
//   npm run local                 arranca (la primera vez prepara todo)
//   npm run local -- --reset      borra la base local y empieza de cero
//   npm run local -- --sin-datos  sin datos de demostracion
//   npm run local -- --puerto 3001
//
// Que hace, en orden:
//
//   1. Abre un Postgres EMBEBIDO guardado en .local/db. Es Postgres de verdad
//      compilado a WebAssembly, instalado como un paquete de npm: no hay Docker, no
//      hay servicio que instalar y no hay cuenta que crear.
//   2. Le agrega lo que Supabase trae de fabrica y un Postgres pelado no: los roles
//      anon / authenticated / service_role, el esquema auth, auth.uid() y una tabla
//      auth.users (que en una instancia de verdad crea GoTrue).
//   3. Aplica LAS MISMAS migraciones que una instancia desplegada, con su RLS.
//   4. Da de alta el administrador de la demo insertandolo en auth.users, para que lo
//      cree el mismo disparador del primer admin que corre en produccion.
//   5. Arranca `next dev` con MODO_LOCAL=true y carga los datos demo.
//
// Lo que NO es: no hay servidor de autenticacion, asi que no hay login ni equipo ni
// invitaciones por correo. Quien abre la URL entra como administrador. Para probar eso
// hace falta una instancia de verdad (ver README).
// ============================================================================

import { existsSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { listarMigraciones, modulosActivos } from "./lib/migraciones.mjs";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const requerir = createRequire(import.meta.url);

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const sinDatos = args.includes("--sin-datos");
const iPuerto = args.indexOf("--puerto");
const puerto = iPuerto >= 0 ? Number(args[iPuerto + 1]) : 3000;

const CARPETA = join(raiz, ".local", "db");
const ID_ADMIN = "00000000-0000-4000-8000-000000000001";
const EMAIL_ADMIN = "demo@local";

function paso(texto) {
  console.log(`[local] ${texto}`);
}

// .env.local es opcional en modo local (de eso se trata), pero si existe hay que leerlo
// antes de opinar sobre que capacidades estan encendidas.
if (existsSync(join(raiz, ".env.local"))) {
  try {
    const { config } = await import("dotenv");
    config({ path: join(raiz, ".env.local"), quiet: true });
  } catch {
    /* sin dotenv: no pasa nada, el modo local no necesita variables */
  }
}

// --- 1. el paquete del Postgres embebido -----------------------------------
let PGlite, pgcrypto;
try {
  ({ PGlite } = requerir("@electric-sql/pglite"));
  ({ pgcrypto } = requerir("@electric-sql/pglite/contrib/pgcrypto"));
} catch {
  console.error("[local] falta @electric-sql/pglite. Corre `npm install` y volve a intentar.");
  process.exit(1);
}

if (reset && existsSync(CARPETA)) {
  rmSync(CARPETA, { recursive: true, force: true });
  paso("base local borrada (--reset)");
}
mkdirSync(CARPETA, { recursive: true });

const esNueva = !existsSync(join(CARPETA, "PG_VERSION"));
const db = new PGlite({ dataDir: CARPETA, extensions: { pgcrypto } });
await db.waitReady;
paso(`base embebida en .local/db${esNueva ? " (nueva)" : ""}`);

// --- 2. lo que Supabase trae de fabrica ------------------------------------
// Idempotente: correrlo de nuevo no toca nada. auth.users es un remedo minimo con las
// tres columnas que leen las migraciones del CRM; en una instancia real la crea GoTrue
// con muchas mas.
const SHIM_AUTH = `
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated noinherit; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role noinherit bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
create or replace function auth.role() returns text language sql stable as
  $f$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated') $f$;
create or replace function auth.email() returns text language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.email', true), '') $f$;
`;

let sembrar = false;
try {
  await db.exec(SHIM_AUTH);
  if (esNueva) paso("esquema auth preparado (roles, auth.users, auth.uid)");

  // --- 3. las mismas migraciones que una instancia de verdad ----------------
  await db.exec(`
    create table if not exists public._migraciones (
      nombre text primary key,
      aplicada_en timestamptz not null default now()
    );
    alter table public._migraciones enable row level security;
  `);

  const aplicadas = new Set(
    (await db.query("select nombre from public._migraciones")).rows.map((r) => r.nombre)
  );
  const pendientes = listarMigraciones(raiz).filter((a) => !aplicadas.has(a.nombre));

  for (const a of pendientes) {
    const contenido = readFileSync(a.ruta, "utf8");
    const inicio = Date.now();
    try {
      await db.transaction(async (tx) => {
        await tx.exec(contenido);
        await tx.query("insert into public._migraciones (nombre) values ($1)", [a.nombre]);
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // pgvector no existe en el Postgres embebido. Es lo unico del repo que lo pide
      // (modulo propiedades, para la busqueda por significado). Se avisa y se sigue:
      // el resto del modulo funciona.
      if (/extension "vector" is not available|type "vector" does not exist/i.test(msg)) {
        paso(`AVISO ${a.nombre} no se aplico: el Postgres embebido no trae pgvector.`);
        paso("AVISO   la busqueda semantica de propiedades no anda en local; el resto si.");
        continue;
      }
      throw new Error(`${a.nombre}: ${msg}`);
    }
    paso(`aplicada ${a.nombre} (${Date.now() - inicio} ms)`);
  }
  if (pendientes.length === 0) paso("migraciones al dia");

  // Red de seguridad, igual que scripts/migrar.mjs: ninguna tabla de public sin RLS.
  const sinRls = await db.query(`
    select c.relname as tabla from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  for (const { tabla } of sinRls.rows) {
    await db.exec(`alter table public."${tabla}" enable row level security`);
    paso(`RLS habilitado en ${tabla} (faltaba)`);
  }

  // --- 4. el administrador de la demo --------------------------------------
  // Se inserta en auth.users y lo da de alta el disparador del primer admin, que es el
  // mismo camino que corre en una instancia desplegada.
  const yaEsta = await db.query("select 1 from public.team_members where id = $1", [ID_ADMIN]);
  if (yaEsta.rows.length === 0) {
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, '{"full_name":"Cuenta demo"}'::jsonb)
       on conflict (id) do nothing`,
      [ID_ADMIN, EMAIL_ADMIN]
    );
    const creado = await db.query("select 1 from public.team_members where id = $1", [ID_ADMIN]);
    if (creado.rows.length === 0) {
      // Ya habia equipo: el disparador no da de alta al segundo. Pasa si alguien corrio
      // migraciones y creo un admin antes. Se inserta a mano para que el modo local
      // tenga con quien entrar.
      await db.query(
        `insert into public.team_members (id, email, name, role, active)
         values ($1, $2, 'Cuenta demo', 'admin', true) on conflict (id) do nothing`,
        [ID_ADMIN, EMAIL_ADMIN]
      );
    }
    paso(`administrador de la demo listo (${EMAIL_ADMIN})`);
  }

  const contactos = await db.query("select count(*)::int n from public.contacts");
  sembrar = !sinDatos && contactos.rows[0].n === 0;
} catch (err) {
  console.error("[local] fallo preparando la base:", err instanceof Error ? err.message : err);
  console.error("[local] si quedo a medias: npm run local -- --reset");
  await db.close().catch(() => {});
  process.exit(1);
}

// La base embebida es un archivo con un solo dueno: hay que soltarla ANTES de que la
// abra el servidor de desarrollo.
await db.close();

const activos = modulosActivos(raiz);
paso(`modulos activos: ${activos.length ? activos.join(", ") : "(ninguno)"}`);

// --- 5. el servidor ---------------------------------------------------------
const servidor = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "-p", String(puerto)],
  {
    cwd: raiz,
    stdio: "inherit",
    env: { ...process.env, MODO_LOCAL: "true" },
    shell: process.platform === "win32",
  }
);

servidor.on("exit", (codigo) => process.exit(codigo ?? 0));
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => servidor.kill(senal));
}

const base = `http://localhost:${puerto}`;

async function esperarServidor() {
  const limite = Date.now() + 180_000;
  while (Date.now() < limite) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return true;
    } catch {
      /* todavia compilando */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

if (await esperarServidor()) {
  if (sembrar) {
    paso("cargando datos de demostracion...");
    try {
      const res = await fetch(`${base}/api/seed/demo`, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        paso(`datos demo: ${json.contactos} contactos, ${json.conversaciones} conversaciones`);
      } else {
        paso(`los datos demo no cargaron (${res.status}). Podes cargarlos desde el inicio.`);
      }
    } catch {
      paso("los datos demo no cargaron. Podes cargarlos con el boton del inicio.");
    }
  }
  console.log("");
  paso(`listo: ${base}`);
  paso("entras directo, sin login: en modo local no hay sesion.");
  if (!process.env.OPENROUTER_API_KEY) {
    paso("el agente de IA esta apagado (falta OPENROUTER_API_KEY en .env.local).");
  }
  console.log("");
}
