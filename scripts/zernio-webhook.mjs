// Da de alta (o repunta) el webhook del CRM en Zernio, sin pasar por el dashboard.
//
//   node scripts/zernio-webhook.mjs                       # lista los webhooks existentes
//   node scripts/zernio-webhook.mjs --url https://tu.app  # crea o actualiza el del CRM
//   node scripts/zernio-webhook.mjs --url ... --test      # ademas dispara un webhook.test
//   node scripts/zernio-webhook.mjs --delete              # borra el del CRM
//
// La URL que se registra es `<url>/api/webhooks/zernio`. Si ya existe un webhook con
// ese nombre lo actualiza (PUT) en vez de crear uno nuevo: Zernio tolera hasta 50 por
// usuario y no valida duplicados de URL, asi que sin esto cada corrida sumaria una
// entrega mas del mismo evento.
//
// El secreto sale de ZERNIO_WEBHOOK_SECRET. Tiene que ser el MISMO valor que este
// cargado en Vercel: si no coinciden, `verifyZernioSignature` rechaza todo con 401 y
// los mensajes entran a Zernio pero nunca llegan al CRM.

import { config } from "dotenv";

config({ path: ".env.local" });

const API_BASE = process.env.ZERNIO_API_BASE || "https://zernio.com/api/v1";
const API_KEY = process.env.ZERNIO_API_KEY || "";
const SECRET = process.env.ZERNIO_WEBHOOK_SECRET || "";

const WEBHOOK_NAME = "Builder CRM";
const WEBHOOK_PATH = "/api/webhooks/zernio";

// Espeja SUBSCRIBED_EVENTS de src/lib/zernio/webhooks.ts. Suscribirse a menos deja
// huecos silenciosos (p.ej. sin `message.sent` no se ve en el CRM lo que el humano
// contesta desde la app de Instagram).
const EVENTS = [
  "conversation.started",
  "message.received",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.edited",
  "message.deleted",
  "account.connected",
  "account.disconnected",
];

if (!API_KEY) {
  console.error("ZERNIO_API_KEY no seteada en .env.local");
  process.exit(1);
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : (process.argv[i + 1] ?? "");
}

async function api(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no-JSON */
  }
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return json;
}

async function listWebhooks() {
  const res = await api("/webhooks/settings");
  return res?.webhooks ?? [];
}

async function main() {
  const baseUrl = arg("--url");
  const shouldDelete = process.argv.includes("--delete");
  const shouldTest = process.argv.includes("--test");

  const existing = await listWebhooks();
  const mine = existing.find((w) => w.name === WEBHOOK_NAME);

  if (!baseUrl && !shouldDelete) {
    console.log(`WEBHOOKS (${existing.length})`);
    if (existing.length === 0) console.log("  (ninguno)");
    for (const w of existing) {
      const flag = w.name === WEBHOOK_NAME ? "  <- el del CRM" : "";
      console.log(`  ${w._id}  ${w.isActive ? "activo " : "APAGADO"}  ${w.name}${flag}`);
      console.log(`      ${w.url}`);
      console.log(`      ${w.events?.length ?? 0} eventos | fallos seguidos: ${w.failureCount ?? 0}`);
      if (w.lastFiredAt) console.log(`      ultimo disparo: ${w.lastFiredAt}`);
    }
    console.log("\nPara crear/actualizar:  node scripts/zernio-webhook.mjs --url https://tu-app.vercel.app");
    return;
  }

  if (shouldDelete) {
    if (!mine) {
      console.log(`No hay webhook llamado "${WEBHOOK_NAME}".`);
      return;
    }
    await api(`/webhooks/settings?id=${encodeURIComponent(mine._id)}`, { method: "DELETE" });
    console.log(`Borrado ${mine._id} (${mine.url})`);
    return;
  }

  if (!SECRET) {
    console.error(
      "ZERNIO_WEBHOOK_SECRET no seteada. Sin secreto el endpoint del CRM es fail-closed\n" +
        "y rechaza todo con 401. Genera uno y cargalo en .env.local y en Vercel:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
    process.exit(1);
  }

  const url = `${baseUrl.replace(/\/$/, "")}${WEBHOOK_PATH}`;
  const payload = { name: WEBHOOK_NAME, url, secret: SECRET, events: EVENTS, isActive: true };

  let webhook;
  if (mine) {
    const res = await api("/webhooks/settings", {
      method: "PUT",
      body: JSON.stringify({ _id: mine._id, ...payload }),
    });
    webhook = res?.webhook;
    console.log(`Actualizado ${mine._id}`);
  } else {
    const res = await api("/webhooks/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    webhook = res?.webhook;
    console.log(`Creado ${webhook?._id ?? "(sin id)"}`);
  }

  console.log(`  url:     ${url}`);
  console.log(`  eventos: ${EVENTS.join(", ")}`);
  console.log(`  secreto: configurado (${SECRET.length} chars)`);

  if (shouldTest) {
    const id = webhook?._id ?? mine?._id;
    console.log("\nDisparando webhook.test...");
    try {
      const res = await api("/webhooks/test", {
        method: "POST",
        body: JSON.stringify({ webhookId: id }),
      });
      console.log(`  ${JSON.stringify(res)}`);
      console.log(
        "  El CRM responde 200 e ignora el evento (no es de mensajeria): con eso alcanza\n" +
          "  para confirmar que la firma valida y la URL es alcanzable."
      );
    } catch (err) {
      console.error(`  fallo: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
