import "server-only";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Tenant por defecto. El CRM es single-tenant por ahora: la migracion de la Fase 1 de
 * WhatsApp Coexistence backfilleo todo al tenant con slug 'default'.
 *
 * Estaba duplicado dentro del webhook de GHL; los ingresos de Zernio lo necesitan
 * tambien, asi que vive aca.
 */
let cached: string | null = null;

export async function resolveDefaultTenantId(): Promise<string | null> {
  if (cached) return cached;
  const [row] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, "default"))
    .limit(1);
  cached = row?.id ?? null;
  return cached;
}
