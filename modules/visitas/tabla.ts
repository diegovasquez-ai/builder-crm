import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { contacts, deals } from "@/db/schema";

/**
 * Tabla del modulo (espejo tipado de migrations/0000_visitas.sql). Drizzle acepta
 * tablas definidas fuera de src/db/schema.ts: el modulo la consulta con `db` del
 * nucleo sin tocar el schema del nucleo.
 */
export const visitas = pgTable("visitas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
  /** Direccion o nombre del lugar a visitar. */
  propertyAddress: text("property_address"),
  /** coordinating | scheduled | completed | cancelled */
  status: text("status").notNull().default("coordinating"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
