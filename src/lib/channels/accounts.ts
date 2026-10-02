import "server-only";
import { db } from "@/db";
import { channelAccounts } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type { Channel, Provider } from "./types";

/**
 * Resolucion de cuentas conectadas por canal. Espeja `whatsapp-accounts.ts`, que hace
 * lo mismo pero solo para WhatsApp por Meta directo:
 *  - Entrante (webhook): se rutea por `zernioAccountId`.
 *  - Saliente (envio/agente): se resuelve por la conversacion o por tenant + canal.
 */

export interface ChannelAccount {
  id: string;
  tenantId: string;
  provider: Provider;
  platform: Channel;
  /** Id de la cuenta en Zernio: la clave de routing entrante. */
  zernioAccountId: string | null;
  zernioProfileId: string | null;
  username: string | null;
  displayName: string | null;
  /** phone_number_id | page_id | ig_business_id, segun la plataforma. */
  externalRef: string | null;
  status: string;
}

type Row = typeof channelAccounts.$inferSelect;

function mapRow(row: Row): ChannelAccount {
  return {
    id: row.id,
    tenantId: row.tenantId,
    provider: row.provider as Provider,
    platform: row.platform as Channel,
    zernioAccountId: row.zernioAccountId,
    zernioProfileId: row.zernioProfileId,
    username: row.username,
    displayName: row.displayName,
    externalRef: row.externalRef,
    status: row.status,
  };
}

/** Routing entrante: resuelve la cuenta del CRM por el accountId que manda Zernio. */
export async function getAccountByZernioId(
  zernioAccountId: string | null | undefined
): Promise<ChannelAccount | null> {
  if (!zernioAccountId) return null;
  const [row] = await db
    .select()
    .from(channelAccounts)
    .where(eq(channelAccounts.zernioAccountId, zernioAccountId))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function getAccountById(
  id: string | null | undefined
): Promise<ChannelAccount | null> {
  if (!id) return null;
  const [row] = await db
    .select()
    .from(channelAccounts)
    .where(eq(channelAccounts.id, id))
    .limit(1);
  return row ? mapRow(row) : null;
}

/**
 * Saliente: cuenta activa de un canal dentro de un tenant.
 *
 * Prioriza la cuenta de Zernio sobre cualquier resto de la integracion directa con Meta.
 * Sin esto, un WhatsApp migrado quedaria con dos filas y la mas vieja (la de Meta, que
 * no tiene `zernioAccountId`) ganaria por fecha, haciendo fallar todos los envios.
 */
export async function getAccountForChannel(
  tenantId: string | null | undefined,
  platform: Channel
): Promise<ChannelAccount | null> {
  if (!tenantId) return null;
  const rows = await db
    .select()
    .from(channelAccounts)
    .where(
      and(
        eq(channelAccounts.tenantId, tenantId),
        eq(channelAccounts.platform, platform),
        eq(channelAccounts.status, "active")
      )
    )
    .orderBy(asc(channelAccounts.createdAt));

  const preferred =
    rows.find((r) => r.provider === "zernio" && r.zernioAccountId) ?? rows[0];
  return preferred ? mapRow(preferred) : null;
}

export async function listAccounts(
  tenantId?: string | null
): Promise<ChannelAccount[]> {
  const rows = tenantId
    ? await db
        .select()
        .from(channelAccounts)
        .where(eq(channelAccounts.tenantId, tenantId))
        .orderBy(asc(channelAccounts.platform), asc(channelAccounts.createdAt))
    : await db
        .select()
        .from(channelAccounts)
        .orderBy(asc(channelAccounts.platform), asc(channelAccounts.createdAt));
  return rows.map(mapRow);
}

export interface UpsertChannelAccountInput {
  tenantId: string;
  platform: Channel;
  provider?: Provider;
  zernioAccountId?: string | null;
  zernioProfileId?: string | null;
  username?: string | null;
  displayName?: string | null;
  externalRef?: string | null;
  status?: string;
  connectedAt?: Date | null;
}

/**
 * Alta/actualizacion idempotente por `zernioAccountId`. La usan tanto el callback de
 * OAuth como el webhook `account.connected`, que pueden llegar en cualquier orden.
 */
export async function upsertZernioAccount(
  input: UpsertChannelAccountInput
): Promise<ChannelAccount | null> {
  if (!input.zernioAccountId) return null;

  const values = {
    tenantId: input.tenantId,
    provider: input.provider ?? ("zernio" as Provider),
    platform: input.platform,
    zernioAccountId: input.zernioAccountId,
    zernioProfileId: input.zernioProfileId ?? null,
    username: input.username ?? null,
    displayName: input.displayName ?? null,
    externalRef: input.externalRef ?? null,
    status: input.status ?? "active",
    connectedAt: input.connectedAt ?? new Date(),
    updatedAt: new Date(),
  };

  const [row] = await db
    .insert(channelAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: channelAccounts.zernioAccountId,
      set: {
        platform: values.platform,
        zernioProfileId: values.zernioProfileId,
        username: values.username,
        displayName: values.displayName,
        status: values.status,
        updatedAt: values.updatedAt,
      },
    })
    .returning();

  return row ? mapRow(row) : null;
}

export async function markAccountStatus(
  zernioAccountId: string,
  status: string
): Promise<void> {
  await db
    .update(channelAccounts)
    .set({ status, updatedAt: new Date() })
    .where(eq(channelAccounts.zernioAccountId, zernioAccountId));
}
