#!/usr/bin/env node
// ============================================================================
// Builder CRM - claves para un Supabase autoalojado
// ============================================================================
// Supabase cloud te da las claves hechas. Autoalojado no: la clave anonima y la de
// servicio son JWT firmados con TU secreto, y tienen que ser los mismos que use
// GoTrue. Este script los genera de una sola vez.
//
//   node scripts/generar-claves-supabase.mjs
//   node scripts/generar-claves-supabase.mjs --anos 5 --env
//
// Con --env imprime las lineas listas para pegar en las variables de la instancia.
// Sin argumentos muestra tambien que va en GoTrue y que va en el CRM.
//
// El secreto NO se guarda en ningun archivo: se imprime una vez. Si lo perdes,
// generas otro, pero entonces todas las sesiones abiertas dejan de valer.
// ============================================================================

import { createHmac, randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const valor = (bandera, porDefecto) => {
  const i = args.indexOf(bandera);
  return i >= 0 && args[i + 1] ? args[i + 1] : porDefecto;
};
const anos = Number(valor("--anos", "10"));
const soloEnv = args.includes("--env");

const base64url = (entrada) =>
  Buffer.from(entrada).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function firmar(payload, secreto) {
  const cabecera = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const cuerpo = base64url(JSON.stringify(payload));
  const firma = createHmac("sha256", secreto)
    .update(`${cabecera}.${cuerpo}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${cabecera}.${cuerpo}.${firma}`;
}

// El secreto de GoTrue tiene que tener al menos 32 caracteres.
const jwtSecret = randomBytes(32).toString("hex");
const ahora = Math.floor(Date.now() / 1000);
const exp = ahora + Math.round(anos * 365 * 24 * 60 * 60);

const anon = firmar({ role: "anon", iss: "supabase", iat: ahora, exp }, jwtSecret);
const service = firmar({ role: "service_role", iss: "supabase", iat: ahora, exp }, jwtSecret);
const postgresPassword = randomBytes(24).toString("base64url");
const workerSecret = randomBytes(32).toString("hex");
const leadsSecret = randomBytes(32).toString("hex");

if (soloEnv) {
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY=${service}`);
  console.log(`POSTGRES_PASSWORD=${postgresPassword}`);
  console.log(`AGENT_WORKER_SECRET=${workerSecret}`);
  console.log(`LEADS_WEBHOOK_SECRET=${leadsSecret}`);
  process.exit(0);
}

const caduca = new Date(exp * 1000).toISOString().slice(0, 10);

console.log(`
Claves generadas. Caducan el ${caduca}. Guardalas ahora: no se vuelven a mostrar.

-- EN GoTrue (el contenedor de autenticacion) --------------------------------
GOTRUE_JWT_SECRET=${jwtSecret}

-- EN EL CRM (variables de la aplicacion) ------------------------------------
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}
SUPABASE_SERVICE_ROLE_KEY=${service}

-- PARA LA BASE DE DATOS ------------------------------------------------------
POSTGRES_PASSWORD=${postgresPassword}

-- SECRETOS INTERNOS DEL CRM --------------------------------------------------
AGENT_WORKER_SECRET=${workerSecret}
LEADS_WEBHOOK_SECRET=${leadsSecret}

La clave anonima viaja al navegador: es publica por diseno. La de servicio NO:
solo en variables del servidor. Las dos estan firmadas con el mismo secreto que
GoTrue, asi que si cambias el secreto hay que regenerar las dos.

Guia completa: docs/SUPABASE-EN-VPS.md
`);
