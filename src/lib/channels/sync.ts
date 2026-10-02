import "server-only";
import { listAccounts as listZernioAccounts, accountIdOf } from "@/lib/zernio/accounts";
import { resolveDefaultTenantId } from "@/lib/tenants";
import { listAccounts, upsertZernioAccount, type ChannelAccount } from "./accounts";
import { isChannel } from "./types";

/**
 * Sincroniza las cuentas conectadas en Zernio hacia `channel_accounts`.
 *
 * El webhook `account.connected` hace lo mismo de forma idempotente, pero no alcanza:
 * las cuentas conectadas antes de dar de alta el webhook nunca dispararon el evento.
 */
export async function syncAccountsFromZernio(): Promise<{
  ok: boolean;
  synced: number;
  skipped: number;
  error?: string;
}> {
  const tenantId = await resolveDefaultTenantId();
  if (!tenantId) {
    return { ok: false, synced: 0, skipped: 0, error: "No existe el tenant default" };
  }

  const result = await listZernioAccounts();
  if (!result.success) {
    return { ok: false, synced: 0, skipped: 0, error: result.error.message };
  }

  let synced = 0;
  let skipped = 0;

  for (const account of result.data.data ?? []) {
    // Zernio soporta 16 plataformas; el CRM modela tres. El resto se ignora en vez de
    // crear filas de canales que la UI no sabe renderizar.
    if (!isChannel(account.platform)) {
      skipped++;
      continue;
    }
    const id = accountIdOf(account);
    if (!id) {
      skipped++;
      continue;
    }

    await upsertZernioAccount({
      tenantId,
      platform: account.platform,
      zernioAccountId: id,
      zernioProfileId: account.profileId ?? null,
      username: account.username ?? null,
      displayName: account.displayName ?? account.name ?? null,
      status: account.status ?? "active",
    });
    synced++;
  }

  return { ok: true, synced, skipped };
}

export async function listChannelAccounts(): Promise<ChannelAccount[]> {
  const tenantId = await resolveDefaultTenantId();
  return listAccounts(tenantId);
}
