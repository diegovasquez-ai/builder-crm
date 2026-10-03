#!/usr/bin/env node
// ============================================================================
// Builder CRM - preparar una base propia para Supabase Auth autoalojado
// ============================================================================
// Supabase cloud trae de fabrica cosas que un Postgres normal no tiene y que las
// migraciones del CRM dan por sentadas:
//
//   - los roles  anon, authenticated, service_role  (las politicas de RLS les hablan),
//   - el esquema auth con su dueno supabase_auth_admin (donde GoTrue crea auth.users),
//   - las funciones auth.uid(), auth.role(), auth.email() y auth.jwt().
//
// Este script las crea si faltan. Es idempotente y NO toca nada que ya exista, asi
// que correrlo contra Supabase cloud no hace dano: informa que no hay nada que hacer.
//
// ORDEN IMPORTANTE. Hay que correrlo ANTES de arrancar GoTrue, porque GoTrue espera
// encontrar el rol supabase_auth_admin, y GoTrue tiene que arrancar antes de aplicar
// las migraciones del CRM, porque la ultima pone un disparador sobre auth.users:
//
//   1. base de datos arriba
//   2. node scripts/preparar-auth-autoalojado.mjs
//   3. arrancar GoTrue  (crea auth.users con sus propias migraciones)
//   4. npm run db:migrar
//
//   node scripts/preparar-auth-autoalojado.mjs
//   node scripts/preparar-auth-autoalojado.mjs --dry-run
//   node scripts/preparar-auth-autoalojado.mjs --auth-password 'otra'
//
// Sin --auth-password, supabase_auth_admin queda con la misma contrasena que trae
// DATABASE_URL, que es lo que hace el stack oficial de Supabase.
// ============================================================================

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.DATABASE_URL && existsSync(join(raiz, ".env.local"))) {
  try {
    const { config } = await import("dotenv");
    config({ path: join(raiz, ".env.local") });
  } catch {
    /* sin dotenv: el entorno ya tiene que traer DATABASE_URL */
  }
}

const args = process.argv.slice(2);
const simulacion = args.includes("--dry-run");
const valorDe = (bandera) => {
  const i = args.indexOf(bandera);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("[auth] falta DATABASE_URL (o DIRECT_URL). Revisa .env.example.");
  process.exit(1);
}

let authPassword = valorDe("--auth-password");
if (!authPassword) {
  try {
    authPassword = decodeURIComponent(new URL(url).password || "");
  } catch {
    authPassword = "";
  }
}
if (!authPassword) {
  console.error("[auth] no pude deducir la contrasena; pasala con --auth-password.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });

const hechos = [];
const omitidos = [];

async function existeRol(nombre) {
  const filas = await sql`select 1 from pg_roles where rolname = ${nombre}`;
  return filas.length > 0;
}

async function existeFuncion(firma) {
  const [fila] = await sql`select to_regprocedure(${firma}) is not null as hay`;
  return Boolean(fila?.hay);
}

async function duenoDeFuncion(firma) {
  const [fila] = await sql`
    select r.rolname
    from pg_proc p
    join pg_roles r on r.oid = p.proowner
    where p.oid = to_regprocedure(${firma})
  `;
  return fila?.rolname ?? null;
}

async function existeEsquema(nombre) {
  const filas = await sql`select 1 from information_schema.schemata where schema_name = ${nombre}`;
  return filas.length > 0;
}

try {
  await sql`select 1`;

  // 1. Roles -----------------------------------------------------------------
  // anon, authenticated y service_role no inician sesion: son los roles a los que
  // las politicas de RLS les dan permiso. supabase_auth_admin si, porque es el
  // usuario con el que GoTrue entra y el dueno del esquema auth.
  for (const rol of ["anon", "authenticated", "service_role"]) {
    if (await existeRol(rol)) {
      omitidos.push(`rol ${rol}`);
      continue;
    }
    if (!simulacion) await sql.unsafe(`create role ${rol} nologin noinherit`);
    hechos.push(`rol ${rol}`);
  }

  if (await existeRol("supabase_auth_admin")) {
    omitidos.push("rol supabase_auth_admin");
  } else {
    if (!simulacion) {
      const escapada = authPassword.replace(/'/g, "''");
      await sql.unsafe(`create role supabase_auth_admin login createrole password '${escapada}'`);
    }
    hechos.push("rol supabase_auth_admin");
  }

  // 2. Esquema auth ----------------------------------------------------------
  if (await existeEsquema("auth")) {
    omitidos.push("esquema auth");
  } else {
    if (!simulacion) {
      await sql.unsafe(`create schema auth authorization supabase_auth_admin`);
    }
    hechos.push("esquema auth");
  }

  if (!simulacion) {
    // Permisos minimos. GoTrue necesita poder crear sus tablas; los otros roles solo
    // necesitan ver el esquema para que auth.uid() se resuelva en las politicas.
    await sql.unsafe(`grant usage on schema auth to anon, authenticated, service_role`);
    await sql.unsafe(`grant all on schema auth to supabase_auth_admin`);
    await sql.unsafe(`alter role supabase_auth_admin set search_path = auth`);
  }

  // 3. Funciones auth.* ------------------------------------------------------
  // Leen los claims que el portador del token deja en la sesion. Sin PostgREST nadie
  // los setea, asi que devuelven null y las politicas niegan todo: es lo correcto,
  // porque la aplicacion entra con el usuario dueno de las tablas y no pasa por RLS.
  const funciones = [
    [
      "auth.uid()",
      `create function auth.uid() returns uuid language sql stable as $fn$
         select coalesce(
           nullif(current_setting('request.jwt.claim.sub', true), ''),
           (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
         )::uuid
       $fn$`,
    ],
    [
      "auth.role()",
      `create function auth.role() returns text language sql stable as $fn$
         select coalesce(
           nullif(current_setting('request.jwt.claim.role', true), ''),
           (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
         )::text
       $fn$`,
    ],
    [
      "auth.email()",
      `create function auth.email() returns text language sql stable as $fn$
         select coalesce(
           nullif(current_setting('request.jwt.claim.email', true), ''),
           (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
         )::text
       $fn$`,
    ],
    [
      "auth.jwt()",
      `create function auth.jwt() returns jsonb language sql stable as $fn$
         select coalesce(
           nullif(current_setting('request.jwt.claim', true), ''),
           nullif(current_setting('request.jwt.claims', true), '')
         )::jsonb
       $fn$`,
    ],
  ];

  // El dueno TIENE que ser supabase_auth_admin. GoTrue vuelve a declarar auth.uid() y
  // auth.role() en su primera migracion con "create or replace", y si las funciones
  // son de otro dueno Postgres lo rechaza ("must be owner of function uid") y GoTrue
  // entra en bucle de reinicio sin crear auth.users.
  for (const [firma, ddl] of funciones) {
    if (await existeFuncion(firma)) {
      const dueno = await duenoDeFuncion(firma);
      if (dueno === "supabase_auth_admin") {
        omitidos.push(`funcion ${firma}`);
      } else {
        if (!simulacion) await sql.unsafe(`alter function ${firma} owner to supabase_auth_admin`);
        hechos.push(`dueno de ${firma} (era ${dueno})`);
      }
      continue;
    }
    if (!simulacion) {
      await sql.unsafe(ddl);
      await sql.unsafe(`alter function ${firma} owner to supabase_auth_admin`);
      await sql.unsafe(`grant execute on function ${firma} to anon, authenticated, service_role`);
    }
    hechos.push(`funcion ${firma}`);
  }

  // 4. Informe ---------------------------------------------------------------
  const prefijo = simulacion ? "[auth] (simulacion) " : "[auth] ";
  if (hechos.length === 0) {
    console.log(`${prefijo}nada que hacer: la base ya tiene los roles, el esquema y las funciones.`);
    console.log("[auth] si esto es Supabase cloud, es lo esperado.");
  } else {
    console.log(`${prefijo}creado: ${hechos.join(", ")}`);
    if (omitidos.length) console.log(`[auth] ya existia: ${omitidos.join(", ")}`);
    if (!simulacion) {
      console.log("[auth] listo. Ahora arranca GoTrue y despues corre npm run db:migrar.");
    }
  }
} catch (err) {
  console.error(`[auth] fallo: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
