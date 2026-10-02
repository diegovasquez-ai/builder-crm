/**
 * Carga (Fase 1) el numero de WhatsApp del CRM en `whatsapp_accounts`, asociado
 * al tenant 'default'. Idempotente por phone_number_id.
 *
 * Correr:  npm run connect:whatsapp
 *   Toma las credenciales de argumentos o, si faltan, de las env WHATSAPP_* que
 *   el CRM ya tiene (.env.local).
 *   Uso opcional: npm run connect:whatsapp -- <phone_number_id> <access_token> <waba_id> <display_phone>
 */
import { config } from "dotenv";
import postgres from "postgres";

async function main() {
  config({ path: ".env.local" });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL no configurada");

  const phoneNumberId = process.argv[2] || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.argv[3] || process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId =
    process.argv[4] || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null;
  const displayPhone =
    process.argv[5] || process.env.WHATSAPP_DISPLAY_PHONE || null;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "Falta phone_number_id o access_token (pasalos como argumentos o seteá WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN en .env.local)"
    );
  }

  const sql = postgres(dbUrl, { prepare: false, max: 1 });
  try {
    const [tenant] =
      await sql`select id from tenants where slug = 'default' limit 1`;
    if (!tenant) {
      throw new Error(
        "No existe el tenant 'default'. Aplicá la migración de coexistence primero."
      );
    }

    const rows = await sql`
      insert into whatsapp_accounts
        (tenant_id, phone_number_id, waba_id, display_phone, access_token, status, connected_at)
      values
        (${tenant.id}, ${phoneNumberId}, ${wabaId}, ${displayPhone}, ${accessToken}, 'active', now())
      on conflict (phone_number_id) do update set
        waba_id       = excluded.waba_id,
        display_phone = excluded.display_phone,
        access_token  = excluded.access_token,
        status        = 'active',
        connected_at  = coalesce(whatsapp_accounts.connected_at, now()),
        updated_at    = now()
      returning id, phone_number_id, waba_id, status
    `;
    console.log("[connect] cuenta WhatsApp lista para el tenant default:");
    console.log("  id:             ", rows[0].id);
    console.log("  phone_number_id:", rows[0].phone_number_id);
    console.log("  waba_id:        ", rows[0].waba_id ?? "(no seteado)");
    console.log("  status:         ", rows[0].status);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[connect] ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
