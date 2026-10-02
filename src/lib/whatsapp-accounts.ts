/**
 * Resolucion de cuentas de WhatsApp por tenant. Reemplaza el modelo de
 * credenciales globales de env: cada numero conectado vive en `whatsapp_accounts`.
 * - Entrante (webhook): se rutea por `phone_number_id`.
 * - Saliente (envio/agente): se resuelve con que cuenta responder via el tenant.
 */
import { db } from "@/db";
import { whatsappAccounts, contacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface WhatsappAccount {
  id: string;
  tenantId: string;
  phoneNumberId: string;
  accessToken: string | null;
  wabaId: string | null;
  displayPhone: string | null;
}

function mapRow(row: typeof whatsappAccounts.$inferSelect): WhatsappAccount {
  return {
    id: row.id,
    tenantId: row.tenantId,
    phoneNumberId: row.phoneNumberId,
    accessToken: row.accessToken,
    wabaId: row.wabaId,
    displayPhone: row.displayPhone,
  };
}

/** Routing entrante: resuelve la cuenta del CRM por el phone_number_id del webhook. */
export async function getAccountByPhoneNumberId(
  phoneNumberId: string | null | undefined
): Promise<WhatsappAccount | null> {
  if (!phoneNumberId) return null;
  const [row] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.phoneNumberId, phoneNumberId))
    .limit(1);
  return row ? mapRow(row) : null;
}

/** Saliente: primera cuenta activa de un tenant (Fase 1 = una cuenta por tenant). */
export async function getAccountByTenant(
  tenantId: string | null | undefined
): Promise<WhatsappAccount | null> {
  if (!tenantId) return null;
  const [row] = await db
    .select()
    .from(whatsappAccounts)
    .where(
      and(
        eq(whatsappAccounts.tenantId, tenantId),
        eq(whatsappAccounts.status, "active")
      )
    )
    .limit(1);
  return row ? mapRow(row) : null;
}

/** Saliente: resuelve la cuenta con la que responder a un contacto (via su tenant). */
export async function getAccountForContact(
  contactId: string
): Promise<WhatsappAccount | null> {
  const [contact] = await db
    .select({ tenantId: contacts.tenantId })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  return getAccountByTenant(contact?.tenantId);
}

/**
 * Cuenta activa "principal" para operaciones no ligadas a un contacto (ej: ABM de
 * plantillas, que viven en el WABA). Fase 1 = single-tenant, devuelve la primera
 * cuenta activa. Fase 2: resolver por el tenant del usuario logueado.
 */
export async function getPrimaryAccount(): Promise<WhatsappAccount | null> {
  const [row] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.status, "active"))
    .limit(1);
  return row ? mapRow(row) : null;
}
