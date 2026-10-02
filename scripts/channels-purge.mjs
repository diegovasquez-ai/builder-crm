// Elimina las conversaciones y mensajes de las cuentas desconectadas.
//
//   npm run channels:purge                 muestra que borraria (no toca nada)
//   npm run channels:purge -- --apply      borra de verdad
//   npm run channels:purge -- --apply --account <zernioAccountId>
//   npm run channels:purge -- --apply --drop-accounts   ademas borra la fila de la cuenta
//   npm run channels:purge -- --dedupe [--apply]        limpia mensajes salientes duplicados
//
// Cuando se desconecta una cuenta, el CRM la marca `disconnected` y deja de mostrar sus
// hilos en la bandeja, pero NO borra nada: si se vuelve a conectar la misma cuenta, el
// historial reaparece solo. Este script es para cuando ya no lo querés mas.
//
// ES DESTRUCTIVO Y NO SE PUEDE DESHACER. Por eso el default es dry-run.

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const DEDUPE = process.argv.includes("--dedupe");
const DROP_ACCOUNTS = process.argv.includes("--drop-accounts");
const accIdx = process.argv.indexOf("--account");
const SOLO_CUENTA = accIdx !== -1 ? process.argv[accIdx + 1] : null;

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL en .env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1,
  onnotice: () => {},
});

/**
 * Limpia los duplicados que dejo el bug del id de envio.
 *
 * Hasta que se arreglo `extractMessageId`, la fila que escribia `deliverMessage`
 * quedaba sin external_id. Cuando despues llegaba el webhook `message.sent` con el
 * eco del mismo mensaje, el indice unico no podia frenarlo (es parcial) y se insertaba
 * una segunda fila. Resultado: el mensaje aparecia dos veces en la bandeja aunque al
 * cliente le llegara una sola.
 *
 * Se borra SIEMPRE la fila sin external_id: es la huerfana. La que trae el id del
 * proveedor es la que sirve para correlacionar entregas y lecturas.
 */
async function dedupeSalientes() {
  const pares = await sql`
    select a.id as huerfano, left(a.body, 50) as body, a.created_at
    from messages a
    join messages b
      on b.conversation_id = a.conversation_id
     and b.direction = 'out' and a.direction = 'out'
     and b.body = a.body
     and b.id <> a.id
     and b.external_id is not null
     and abs(extract(epoch from (b.created_at - a.created_at))) < 120
    where a.external_id is null
    order by a.created_at desc`;

  console.log(
    APPLY
      ? "BORRANDO duplicados"
      : "SIMULACION de duplicados, no se toca nada"
  );
  console.log(`Pares duplicados encontrados: ${pares.length}`);
  for (const d of pares) {
    console.log(`  ${d.created_at.toISOString().slice(0, 16)}  ${d.body}`);
  }

  if (pares.length === 0) {
    console.log("\nNada para limpiar.");
    return;
  }

  if (!APPLY) {
    console.log("\nPara aplicarlo:  npm run channels:purge -- --dedupe --apply");
    return;
  }

  const ids = pares.map((d) => d.huerfano);
  await sql`delete from messages where id = any(${ids})`;
  console.log(`\nBorradas ${ids.length} filas duplicadas.`);
}

async function main() {
  if (DEDUPE) {
    await dedupeSalientes();
    await sql.end();
    return;
  }

  const cuentas = SOLO_CUENTA
    ? await sql`
        select id, platform, username, status, zernio_account_id
        from channel_accounts
        where zernio_account_id = ${SOLO_CUENTA} or id::text = ${SOLO_CUENTA}`
    : await sql`
        select id, platform, username, status, zernio_account_id
        from channel_accounts
        where status = 'disconnected'
        order by platform`;

  if (cuentas.length === 0) {
    console.log(
      SOLO_CUENTA
        ? `No encontre ninguna cuenta con ese id.`
        : "No hay cuentas desconectadas. Nada para limpiar."
    );
    await sql.end();
    return;
  }

  console.log(
    APPLY ? "BORRANDO (esto no se puede deshacer)\n" : "SIMULACION — no se toca nada\n"
  );

  let totalHilos = 0;
  let totalMensajes = 0;

  for (const c of cuentas) {
    const [{ hilos }] = await sql`
      select count(*)::int as hilos from conversations where account_id = ${c.id}`;
    const [{ msgs }] = await sql`
      select count(*)::int as msgs from messages
      where conversation_id in (select id from conversations where account_id = ${c.id})`;

    console.log(
      `${c.platform.padEnd(10)} ${String(c.username ?? "-").padEnd(24)} ` +
        `${String(c.status).padEnd(13)} ${String(hilos).padStart(3)} hilos, ${String(msgs).padStart(4)} mensajes`
    );

    totalHilos += hilos;
    totalMensajes += msgs;

    if (!APPLY || hilos === 0) continue;

    // Orden: primero los mensajes, despues los hilos. Las citas y actividades del
    // contacto NO se tocan: son del contacto, no del canal por el que escribio.
    await sql`
      delete from messages
      where conversation_id in (select id from conversations where account_id = ${c.id})`;

    // Trabajos del agente que quedaron encolados para esos hilos.
    await sql`
      delete from agent_jobs
      where conversation_id in (select id from conversations where account_id = ${c.id})`;

    await sql`delete from conversations where account_id = ${c.id}`;

    if (DROP_ACCOUNTS) {
      await sql`delete from channel_accounts where id = ${c.id}`;
      console.log(`  cuenta eliminada`);
    }
  }

  console.log(
    `\n${APPLY ? "Borrados" : "Se borrarian"}: ${totalHilos} hilos y ${totalMensajes} mensajes ` +
      `de ${cuentas.length} cuenta(s).`
  );

  if (!APPLY && totalHilos > 0) {
    console.log("\nPara aplicarlo de verdad:  npm run channels:purge -- --apply");
    console.log("Los contactos, citas y actividades NO se tocan.");
  }

  // Contactos que se quedaron sin ninguna conversacion ni operacion: quedan huerfanos
  // en la lista y no sirven para nada.
  const [{ huerfanos }] = await sql`
    select count(*)::int as huerfanos from contacts c
    where not exists (select 1 from conversations v where v.contact_id = c.id)
      and not exists (select 1 from deals d where d.contact_id = c.id)
      and not exists (select 1 from activities a where a.contact_id = c.id)`;

  if (huerfanos > 0) {
    console.log(
      `\nAviso: quedan ${huerfanos} contactos sin conversaciones, operaciones ni ` +
        `actividades.\nSe pueden borrar desde Contactos si no los queres.`
    );
  }

  await sql.end();
}

main().catch(async (err) => {
  console.error(err.message);
  await sql.end().catch(() => {});
  process.exit(1);
});
