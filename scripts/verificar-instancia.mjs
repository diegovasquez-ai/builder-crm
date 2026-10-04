#!/usr/bin/env node
// Autoverificacion de una instancia de Builder CRM (local o desplegada).
//
//   node scripts/verificar-instancia.mjs --url https://crm.cliente.com \
//     --email admin@cliente.com --password '...' --secreto '<AGENT_WORKER_SECRET>' \
//     [--marca "Casa Sur"] [--etapas nuevo,calificado] [--modulos propiedades,visitas] \
//     [--guion "Hola, busco un depto..."] [--sin-agente]
//
// Comprueba, en orden: health, login (Supabase Auth + /api/team/me), marca (manifest),
// pipeline/config (/api/simulador/estado), conversacion de prueba por el simulador con
// respuesta del agente y operacion en el pipeline, y modulos activos. Sale con 1 si
// algo falla. Es lo que corre la skill probar-instancia (constitucion, principio III).

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// `.env.local` se carga SOLO cuando no se pasa --url, o sea cuando se verifica la
// instancia local. Verificando una remota seria una trampa: las credenciales de
// Supabase del entorno local apuntan a otra base, el login falla con "Invalid login
// credentials" y parece un problema de la instancia. Con --url hay que pasar
// --supabase-url y --anon-key (o exportarlas en la terminal).
if (!process.argv.includes("--url") && existsSync(join(raiz, ".env.local"))) {
  try {
    const { config } = await import("dotenv");
    config({ path: join(raiz, ".env.local") });
  } catch {
    /* sin dotenv */
  }
}

const args = process.argv.slice(2);
const opt = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const flag = (f) => args.includes(f);

const base = (opt("--url", process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")).replace(/\/$/, "");
const email = opt("--email", process.env.DEMO_ADMIN_EMAIL);
const password = opt("--password", process.env.DEMO_ADMIN_PASSWORD);
const secreto = opt("--secreto", process.env.AGENT_WORKER_SECRET);
const marcaEsperada = opt("--marca", null);
const etapasEsperadas = (opt("--etapas", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const modulosEsperados = (opt("--modulos", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const sinAgente = flag("--sin-agente");
const guion = (opt("--guion", "") || "")
  ? [opt("--guion", "")]
  : [
      "Hola! Vi una publicacion de ustedes y quiero mas informacion.",
      "Busco algo de 2 dormitorios, por la zona centro, tengo un presupuesto de 150 mil para comprar.",
    ];

const resultados = [];
const ok = (nombre, detalle = "") => resultados.push({ check: nombre, estado: "OK", detalle });
const fallo = (nombre, detalle = "") => resultados.push({ check: nombre, estado: "FALLO", detalle });
const salto = (nombre, detalle = "") => resultados.push({ check: nombre, estado: "SALTADO", detalle });

const bearer = secreto ? { Authorization: `Bearer ${secreto}` } : {};
let cookie = "";

async function getJson(path, init = {}) {
  const res = await fetch(base + path, { ...init, headers: { ...(init.headers || {}), ...(cookie ? { cookie } : {}) }, signal: AbortSignal.timeout(init.timeout ?? 30_000) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* no json */
  }
  return { res, json, text };
}

// 1. Health -------------------------------------------------------------------------
let salud = null;
try {
  const { res, json } = await getJson("/api/health");
  if (res.ok && json?.ok) {
    salud = json;
    ok("Responde (/api/health)", `v${json.version}${json.commit ? " " + json.commit.slice(0, 7) : ""}`);
  } else {
    fallo("Responde (/api/health)", `${res.status} ${json?.error ?? ""} ${json?.faltan ? "faltan: " + json.faltan.join(", ") : ""} ${json?.detalle ? json.detalle.join("; ") : ""}`.trim());
  }
} catch (err) {
  fallo("Responde (/api/health)", err.message);
}

// 2. Login ----------------------------------------------------------------------------
// Password grant contra Supabase Auth y cookie en el formato de @supabase/ssr para
// llamar a las rutas con sesion. Si el formato cambia, el check de sesion queda como
// "no verificado" pero el login en si (el grant) ya probo que la cuenta funciona.
const supabaseUrl = opt("--supabase-url", process.env.NEXT_PUBLIC_SUPABASE_URL);
const anonKey = opt("--anon-key", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
if (!email || !password) {
  salto("Login", "sin --email/--password");
} else if (!supabaseUrl || !anonKey) {
  salto("Login", "sin NEXT_PUBLIC_SUPABASE_URL / ANON_KEY (pasar --supabase-url y --anon-key)");
} else {
  try {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(20_000),
    });
    const sesion = await res.json();
    if (!res.ok || !sesion.access_token) {
      fallo("Login (Supabase Auth)", sesion.error_description ?? sesion.msg ?? `HTTP ${res.status}`);
    } else {
      ok("Login (Supabase Auth)", email);

      // Que formas de entrar admite la instancia. Es informativo: el acceso real lo
      // decide team_members, no el proveedor. Ver docs/GOOGLE-AUTH.md.
      try {
        const ajustes = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`, {
          headers: { apikey: anonKey },
          signal: AbortSignal.timeout(10_000),
        });
        if (ajustes.ok) {
          const datos = await ajustes.json();
          const externos = Object.entries(datos.external ?? {})
            .filter(([, encendido]) => encendido === true)
            .map(([nombre]) => nombre)
            .filter((n) => n !== "email" && n !== "phone");
          const formas = externos.length ? `email y ${externos.join(", ")}` : "solo email y contrasena";
          // El correo lo declara la instancia (/api/health), no el proveedor: GoTrue no
          // dice si tiene SMTP. Ver docs/CORREO.md.
          const correo = salud?.correo
            ? "invitaciones y recuperacion por correo: si"
            : "invitaciones por correo: no (el admin reparte contrasenas a mano)";
          resultados.push({
            check: "Formas de entrar",
            estado: "INFO",
            detalle: `${formas}; ${correo}`,
          });
        }
      } catch {
        /* informativo: si no responde, no se informa */
      }

      const ref = new URL(supabaseUrl).hostname.split(".")[0];
      const valor = "base64-" + Buffer.from(JSON.stringify(sesion)).toString("base64url");
      const trozos = valor.match(/.{1,3180}/g) ?? [valor];
      cookie = trozos.length === 1 ? `sb-${ref}-auth-token=${valor}` : trozos.map((t, i) => `sb-${ref}-auth-token.${i}=${t}`).join("; ");
      const yo = await getJson("/api/team/me");
      if (yo.res.ok && yo.json?.member) ok("Sesion en el CRM (/api/team/me)", `rol ${yo.json.member.role}`);
      else {
        fallo("Sesion en el CRM (/api/team/me)", `${yo.res.status}: la cuenta no esta en team_members o la cookie no fue aceptada`);
        cookie = "";
      }
    }
  } catch (err) {
    fallo("Login (Supabase Auth)", err.message);
  }
}

// 3. Marca ----------------------------------------------------------------------------
try {
  const { res, json } = await getJson("/manifest.webmanifest");
  if (!res.ok || !json?.name) fallo("Marca (manifest)", `HTTP ${res.status}`);
  else if (marcaEsperada && json.name !== marcaEsperada) fallo("Marca (manifest)", `esperaba "${marcaEsperada}", hay "${json.name}"`);
  else {
    ok("Marca (manifest)", json.name);
    // La plantilla viene con la marca de IA Builder Lab. Para una instancia de cliente
    // eso hay que cambiarlo en config/cliente.ts, y olvidarselo no da ningun error:
    // simplemente el cliente ve el logo de la comunidad. Por eso se avisa.
    if (!marcaEsperada && json.name === "Builder CRM") {
      resultados.push({
        check: "Marca propia del cliente",
        estado: "INFO",
        detalle: "sigue la marca de la plantilla; si la instancia es para un cliente, cambiala en config/cliente.ts y corre pwa:icons",
      });
    }
  }
} catch (err) {
  fallo("Marca (manifest)", err.message);
}

// 4. Pipeline, campos y modulos ---------------------------------------------------------
let estado = null;
{
  const { res, json } = await getJson("/api/simulador/estado", { headers: bearer });
  if (res.ok && json) {
    estado = json;
    const claves = json.etapas.map((e) => e.clave ?? e.nombre);
    const faltan = etapasEsperadas.filter((e) => !claves.includes(e));
    if (faltan.length) fallo("Pipeline", `faltan etapas: ${faltan.join(", ")} (hay: ${claves.join(", ")})`);
    else ok("Pipeline", `${json.etapas.length} etapas: ${claves.join(", ")}`);
    const faltanM = modulosEsperados.filter((m) => !json.modulos.includes(m));
    if (faltanM.length) fallo("Modulos activos", `faltan: ${faltanM.join(", ")} (hay: ${json.modulos.join(", ") || "ninguno"})`);
    else ok("Modulos activos", json.modulos.join(", ") || "ninguno");
    ok("Campos del contacto", `${json.campos.length}: ${json.campos.map((c) => c.clave).join(", ") || "ninguno"}`);
    if (!json.agente.configurado) salto("Agente configurado", "falta OPENROUTER_API_KEY en la instancia");
    else ok("Agente configurado", json.agente.modelo);
  } else {
    fallo("Pipeline/config (/api/simulador/estado)", `${res.status} ${json?.error ?? ""} (hace falta --secreto o una sesion admin)`);
  }
}

// 5. Conversacion de prueba -----------------------------------------------------------
if (sinAgente || !estado?.agente?.configurado) {
  salto("Conversacion de prueba", sinAgente ? "--sin-agente" : "sin agente configurado");
} else {
  try {
    const creada = await getJson("/api/simulador/conversaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...bearer },
      body: JSON.stringify({ canal: "whatsapp", nombre: "Prueba automatica" }),
    });
    if (!creada.res.ok) throw new Error(`crear conversacion: ${creada.res.status} ${creada.json?.error ?? ""}`);
    const { conversationId, contactId } = creada.json;
    let respondio = false;
    let ultimo = null;
    for (const texto of guion) {
      const r = await getJson("/api/simulador/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...bearer },
        body: JSON.stringify({ conversationId, texto }),
        timeout: 90_000,
      });
      if (!r.res.ok) throw new Error(`mensaje: ${r.res.status} ${r.json?.mensaje ?? r.json?.error ?? ""}`);
      ultimo = r.json;
      if (r.json.agente?.ok) respondio = true;
    }
    if (respondio) ok("El agente responde", `"${(ultimo.agente.reply ?? "").slice(0, 80)}..." (${ultimo.agente.toolCalls ?? 0} tools)`);
    else fallo("El agente responde", ultimo?.agente?.reason ?? "sin respuesta");

    // Lo que se comprueba es que el agente ACTUE sobre el CRM, no que use una tool
    // concreta: cuando mueve la etapa lo decide el prompt del cliente, no el codigo.
    // Si no dejo ningun rastro, eso si es un fallo: significa que las tools no llegan.
    const e = ultimo?.estado;
    const rastros = [];
    if (e?.etapa) rastros.push(`etapa: ${e.etapa}`);
    if (e?.campos && Object.keys(e.campos).length) rastros.push(`campos: ${Object.keys(e.campos).join(", ")}`);
    if (e?.resumen) rastros.push("resumen del lead");
    if (e?.nombre && e.nombre !== "Simulador" && !e.nombre.startsWith("+")) rastros.push(`nombre: ${e.nombre}`);
    if (rastros.length) {
      ok("El agente actua sobre el CRM", rastros.join(" · "));
      if (!e?.etapa) {
        resultados.push({
          check: "La operacion entra al pipeline",
          estado: "INFO",
          detalle: "el agente no movio la etapa en este turno; depende del prompt del cliente",
        });
      }
    } else {
      fallo("El agente actua sobre el CRM", "no dejo rastro: ni etapa, ni campos, ni resumen, ni nombre");
    }

    if (cookie) {
      const lista = await getJson("/api/conversations");
      const items = Array.isArray(lista.json) ? lista.json : lista.json?.conversations ?? [];
      const esta = Array.isArray(items) && items.some((c) => c.conversationId === conversationId || c.id === conversationId);
      if (lista.res.ok && esta) ok("La conversacion esta en la bandeja", conversationId);
      else if (lista.res.ok) fallo("La conversacion esta en la bandeja", "no aparece en /api/conversations");
      else salto("La conversacion esta en la bandeja", `/api/conversations ${lista.res.status}`);
    } else {
      salto("La conversacion esta en la bandeja", "sin sesion");
    }
    resultados.push({ check: "Contacto de prueba", estado: "INFO", detalle: `${contactId} (etiqueta simulador; se puede borrar)` });
  } catch (err) {
    fallo("Conversacion de prueba", err.message);
  }
}

// 6. Modulos -------------------------------------------------------------------------------
for (const m of estado?.modulos ?? modulosEsperados) {
  if (!cookie) {
    salto(`Modulo ${m}`, "sin sesion");
    continue;
  }
  const r = await getJson(`/api/m/${m}`);
  if (r.res.status === 200) ok(`Modulo ${m}`, `/api/m/${m} responde`);
  else if (r.res.status === 405 || r.res.status === 404) salto(`Modulo ${m}`, `sin GET en la raiz (${r.res.status}); probar su pagina a mano`);
  else fallo(`Modulo ${m}`, `${r.res.status}`);
}

// Resumen -------------------------------------------------------------------------------------
console.log(`\nVerificacion de ${base}${salud ? ` (v${salud.version})` : ""}\n`);
const ancho = Math.max(...resultados.map((r) => r.check.length));
for (const r of resultados) {
  const icono = r.estado === "OK" ? "✔" : r.estado === "FALLO" ? "✘" : r.estado === "INFO" ? "ℹ" : "–";
  console.log(`${icono} ${r.check.padEnd(ancho)}  ${r.estado.padEnd(7)} ${r.detalle}`);
}
const fallos = resultados.filter((r) => r.estado === "FALLO").length;
console.log(`\n${fallos === 0 ? "TODO EN VERDE" : `${fallos} check(s) en rojo`}\n`);
process.exit(fallos === 0 ? 0 : 1);
