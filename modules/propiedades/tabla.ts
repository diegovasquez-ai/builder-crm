import { pgTable, text, integer, numeric, boolean, timestamp, jsonb, vector } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Catalogo de propiedades (espejo tipado de migrations/0000_propiedades.sql).
 * `embedding` requiere la extension pgvector; es nullable: sin OPENAI_API_KEY el
 * catalogo funciona igual con busqueda por filtros.
 */
export const propiedades = pgTable("propiedades", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  /** Id en el origen (Tokko u otro). Unico. */
  externalId: text("external_id").notNull().unique(),
  referenceCode: text("reference_code"),
  title: text("title"),
  propertyType: text("property_type"),
  operation: text("operation"),
  price: numeric("price"),
  currency: text("currency"),
  rooms: integer("rooms"),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  surfaceTotal: numeric("surface_total"),
  surfaceCovered: numeric("surface_covered"),
  neighborhood: text("neighborhood"),
  fullLocation: text("full_location"),
  address: text("address"),
  geoLat: numeric("geo_lat"),
  geoLng: numeric("geo_lng"),
  creditEligible: boolean("credit_eligible"),
  expenses: numeric("expenses"),
  amenities: text("amenities").array().notNull().default(sql`'{}'::text[]`),
  coverPhoto: text("cover_photo"),
  photos: jsonb("photos").notNull().default(sql`'[]'::jsonb`),
  publicUrl: text("public_url"),
  status: integer("status"),
  description: text("description"),
  embeddingText: text("embedding_text"),
  embedding: vector("embedding", { dimensions: 1536 }),
  raw: jsonb("raw"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
