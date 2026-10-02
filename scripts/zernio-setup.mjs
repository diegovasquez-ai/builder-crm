// Inspecciona la cuenta de Zernio y sincroniza las cuentas conectadas a `channel_accounts`.
//
//   node scripts/zernio-setup.mjs            # lista profiles, cuentas y conversaciones
//   node scripts/zernio-setup.mjs --sync     # ademas upsertea las cuentas en la DB
//
// Es la verificacion de la Fase 2: si esto lista tus cuentas de Instagram/Facebook,
// el cliente y las credenciales estan bien y se puede seguir con el webhook.

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const API_BASE = process.env.ZERNIO_API_BASE || "https://zernio.com/api/v1";
const API_KEY = process.env.ZERNIO_API_KEY || "";
const PROFILE_ID = process.env.ZERNIO_PROFILE_ID || "";

if (!API_KEY) {
  console.error("ZERNIO_API_KEY no seteada en .env.local");
  process.exit(1);
}

const shouldSync = process.argv.includes("--sync");

async function api(path, query) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta no-JSON */
  }
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return json;
}

const CHANNELS = new Set(["whatsapp", "instagram", "facebook"]);

async function main() {
  console.log(`API base: ${API_BASE}\n`);

  const profiles = await api("/profiles");
  const profileList = profiles?.data ?? profiles?.profiles ?? [];
  console.log("PROFILES");
  if (profileList.length === 0) {
    console.log("  (ninguno)");
  }
  for (const p of profileList) {
    const id = p._id ?? p.id;
    const isEnv = id === PROFILE_ID ? "  <- ZERNIO_PROFILE_ID" : "";
    console.log(`  ${id}  ${p.name ?? ""}${isEnv}`);
  }
  if (!PROFILE_ID) {
    console.log("\n  ZERNIO_PROFILE_ID no esta seteada. Copia el id del profile Default de arriba.");
  }

  const accounts = await api("/accounts");
  const accountList = accounts?.data ?? accounts?.accounts ?? [];
  console.log(`\nCUENTAS CONECTADAS (${accountList.length})`);
  for (const a of accountList) {
    const id = a.id ?? a._id;
    const soportado = CHANNELS.has(a.platform) ? "" : "  (plataforma no usada por el CRM)";
    console.log(
      `  [${a.platform}] ${a.username ?? a.name ?? a.displayName ?? "sin nombre"}  id=${id}${soportado}`
    );
  }
  if (accountList.length === 0) {
    console.log("  (ninguna) Conecta Instagram y tu Pagina de Facebook desde el dashboard de Zernio.");
  }

  const convs = await api("/inbox/conversations", {
    profileId: PROFILE_ID || undefined,
    limit: 5,
  });
  const convList = convs?.data ?? [];
  console.log(`\nULTIMAS CONVERSACIONES (${convList.length} de muestra)`);
  for (const c of convList) {
    console.log(
      `  [${c.platform}] ${c.participantName ?? c.participantId} - "${(c.lastMessage ?? "").slice(0, 50)}"`
    );
  }
  if (convs?.meta?.failedAccounts?.length) {
    console.log("\n  Cuentas que fallaron en la consulta:");
    for (const f of convs.meta.failedAccounts) {
      console.log(`    ${f.accountUsername ?? f.accountId}: ${f.error}`);
    }
  }

  if (!shouldSync) {
    console.log("\n(correr con --sync para guardar las cuentas en channel_accounts)");
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("\nDATABASE_URL no seteada, no se puede sincronizar");
    process.exitCode = 1;
    return;
  }

  const sql = postgres(url, { prepare: false, max: 1 });
  try {
    const [tenant] = await sql`select id from tenants where slug = 'default' limit 1`;
    if (!tenant) {
      console.error("\nNo existe el tenant 'default'. Aplicar antes las migraciones.");
      process.exitCode = 1;
      return;
    }

    let synced = 0;
    for (const a of accountList) {
      if (!CHANNELS.has(a.platform)) continue;
      const id = a.id ?? a._id;
      if (!id) continue;
      await sql`
        insert into channel_accounts
          (tenant_id, provider, platform, zernio_account_id, zernio_profile_id,
           username, display_name, status, connected_at)
        values
          (${tenant.id}, 'zernio', ${a.platform}, ${id}, ${a.profileId ?? PROFILE_ID ?? null},
           ${a.username ?? null}, ${a.displayName ?? a.name ?? null}, 'active', now())
        on conflict (zernio_account_id) do update set
          platform     = excluded.platform,
          username     = excluded.username,
          display_name = excluded.display_name,
          status       = 'active',
          updated_at   = now()
      `;
      synced++;
    }
    console.log(`\nSincronizadas ${synced} cuentas en channel_accounts.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exitCode = 1;
});
