/**
 * Carga (MVP) del catalogo de Tokko a la tabla `propiedades`.
 * Trae todas las propiedades, genera embeddings y hace upsert por tokko_id.
 *
 * Correr:  npm run sync:tokko
 *   (carga TOKKO_API_KEY + OPENAI_API_KEY + DATABASE_URL desde .env.local via --env-file)
 *
 * Idempotente: re-correr actualiza precios/datos, no duplica.
 */
import { config } from "dotenv";
import postgres from "postgres";
import { listAllProperties, mapTokkoToPropertyRow } from "../lib/tokko";
import { embedBatch, toVectorLiteral } from "../lib/embeddings";

async function main() {
  config({ path: ".env.local" });
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL no configurada");
  if (!process.env.TOKKO_API_KEY) throw new Error("TOKKO_API_KEY no configurada");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no configurada");

  const sql = postgres(dbUrl, { prepare: false, max: 1 });

  try {
    console.log("[sync] trayendo propiedades de Tokko...");
    const props = await listAllProperties();
    console.log(`[sync] ${props.length} propiedades recibidas`);
    if (props.length === 0) {
      console.log("[sync] nada para cargar, salgo.");
      return;
    }

    const rows = props.map(mapTokkoToPropertyRow);

    console.log("[sync] generando embeddings (OpenAI text-embedding-3-small)...");
    const embeddings = await embedBatch(rows.map((r) => r.embedding_text));
    console.log(`[sync] ${embeddings.length} embeddings generados`);

    let inserted = 0;
    let updated = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const emb = toVectorLiteral(embeddings[i]);
      const result = await sql`
        insert into propiedades (
          external_id, reference_code, title, property_type, operation, price, currency,
          rooms, bedrooms, bathrooms, surface_total, surface_covered,
          neighborhood, full_location, address, geo_lat, geo_lng,
          credit_eligible, expenses, amenities, cover_photo, photos,
          public_url, status, description, embedding_text, embedding, raw, synced_at
        ) values (
          ${r.external_id}, ${r.reference_code}, ${r.title}, ${r.property_type}, ${r.operation},
          ${r.price}, ${r.currency}, ${r.rooms}, ${r.bedrooms}, ${r.bathrooms},
          ${r.surface_total}, ${r.surface_covered}, ${r.neighborhood}, ${r.full_location},
          ${r.address}, ${r.geo_lat}, ${r.geo_lng}, ${r.credit_eligible}, ${r.expenses},
          ${r.amenities}, ${r.cover_photo}, ${sql.json(r.photos)},
          ${r.public_url}, ${r.status}, ${r.description}, ${r.embedding_text},
          ${emb}::vector, ${sql.json(r.raw as unknown as Parameters<typeof sql.json>[0])}, now()
        )
        on conflict (external_id) do update set
          reference_code  = excluded.reference_code,
          title           = excluded.title,
          property_type   = excluded.property_type,
          operation       = excluded.operation,
          price           = excluded.price,
          currency        = excluded.currency,
          rooms           = excluded.rooms,
          bedrooms        = excluded.bedrooms,
          bathrooms       = excluded.bathrooms,
          surface_total   = excluded.surface_total,
          surface_covered = excluded.surface_covered,
          neighborhood    = excluded.neighborhood,
          full_location   = excluded.full_location,
          address         = excluded.address,
          geo_lat         = excluded.geo_lat,
          geo_lng         = excluded.geo_lng,
          credit_eligible = excluded.credit_eligible,
          expenses        = excluded.expenses,
          amenities       = excluded.amenities,
          cover_photo     = excluded.cover_photo,
          photos          = excluded.photos,
          public_url      = excluded.public_url,
          status          = excluded.status,
          description     = excluded.description,
          embedding_text  = excluded.embedding_text,
          embedding       = excluded.embedding,
          raw             = excluded.raw,
          synced_at       = now(),
          updated_at      = now()
        returning (xmax = 0) as inserted
      `;
      if (result[0]?.inserted) inserted++;
      else updated++;
    }

    const [{ count }] =
      await sql`select count(*)::int as count from propiedades`;
    const [{ with_emb }] =
      await sql`select count(*)::int as with_emb from propiedades where embedding is not null`;
    console.log(`[sync] OK · insertadas: ${inserted} · actualizadas: ${updated}`);
    console.log(`[sync] total en tabla: ${count} · con embedding: ${with_emb}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[sync] ERROR:", err);
  process.exit(1);
});
