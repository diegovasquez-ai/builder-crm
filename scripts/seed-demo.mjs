#!/usr/bin/env node
// Carga los datos de demostracion en una instancia (local o desplegada).
//
//   npm run seed                              -> contra APP_BASE_URL / NEXT_PUBLIC_APP_URL / localhost:3000
//   node scripts/seed-demo.mjs --url https://crm.cliente.com
//
// Pega a POST /api/seed/demo con AGENT_WORKER_SECRET como Bearer (la ruta tambien
// acepta un admin con sesion desde el boton del inicio). Es idempotente.

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.AGENT_WORKER_SECRET && existsSync(join(raiz, ".env.local"))) {
  try {
    const { config } = await import("dotenv");
    config({ path: join(raiz, ".env.local") });
  } catch {
    /* sin dotenv */
  }
}

const args = process.argv.slice(2);
const i = args.indexOf("--url");
const base = (i >= 0 ? args[i + 1] : process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const secreto = process.env.AGENT_WORKER_SECRET;
if (!secreto) {
  console.error("[seed] falta AGENT_WORKER_SECRET (el mismo que tiene la instancia).");
  process.exit(1);
}

const res = await fetch(`${base}/api/seed/demo`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secreto}` },
  signal: AbortSignal.timeout(90_000),
});
const json = await res.json().catch(() => ({}));
if (!res.ok || !json.ok) {
  console.error(`[seed] fallo (${res.status}):`, json.error ?? json);
  process.exit(1);
}
console.log(
  json.yaExistia
    ? "[seed] la demo del nucleo ya estaba cargada (no se duplico)"
    : `[seed] contactos: ${json.contactos}, operaciones: ${json.operaciones}, conversaciones: ${json.conversaciones}, mensajes: ${json.mensajes}`
);
if (json.modulos?.length) console.log(`[seed] modulos sembrados: ${json.modulos.join(", ")}`);
