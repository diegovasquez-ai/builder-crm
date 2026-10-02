import "server-only";
import { db } from "@/db";
import { agentConfigs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { resolveDefaultTenantId } from "@/lib/tenants";
import { CHANNELS, type Channel } from "@/lib/channels/types";
import { getEnabledToolNames, nombresDeTools } from "./tools";
import { getDefaultSystemPromptTemplate, getGlobalSystemPromptTemplate } from "./prompt";
import { getAgentModel } from "./openrouter";

/**
 * Configuracion del agente POR CANAL.
 *
 * El pedido concreto fue "los agentes no deben ser iguales": el que contesta un DM de
 * Instagram no puede tener el mismo prompt que el de WhatsApp. La resolucion es en
 * cascada, asi nada de lo que ya estaba configurado se rompe:
 *
 *   agent_configs[canal]  ->  crm_settings['agent.*'] (global)  ->  default del codigo
 */

export interface ResolvedAgentConfig {
  channel: Channel;
  enabled: boolean;
  systemPrompt: string;
  enabledTools: string[];
  model: string;
  /** true si el valor viene del global y no de una config propia del canal. */
  promptInherited: boolean;
  toolsInherited: boolean;
  modelInherited: boolean;
}

export async function getAgentConfig(
  channel: Channel
): Promise<ResolvedAgentConfig> {
  const tenantId = await resolveDefaultTenantId();

  const row = tenantId ? await readRow(tenantId, channel) : null;

  const ownPrompt = row?.systemPrompt?.trim();
  const ownTools = row?.enabledTools;
  const ownModel = row?.model?.trim();

  return {
    channel,
    // Sin fila, WhatsApp queda encendido (comportamiento actual) y los canales nuevos
    // tambien: la fila de la migracion los crea explicitamente en false.
    enabled: row?.enabled ?? true,
    systemPrompt: ownPrompt || (await getGlobalSystemPromptTemplate()),
    enabledTools: ownTools?.length
      ? filterValidTools(ownTools)
      : await getEnabledToolNames(),
    model: ownModel || getAgentModel(),
    promptInherited: !ownPrompt,
    toolsInherited: !ownTools?.length,
    modelInherited: !ownModel,
  };
}

async function readRow(tenantId: string, channel: Channel) {
  const [row] = await db
    .select()
    .from(agentConfigs)
    .where(
      and(eq(agentConfigs.tenantId, tenantId), eq(agentConfigs.channel, channel))
    )
    .limit(1);
  return row ?? null;
}

function filterValidTools(names: string[]): string[] {
  const validos = new Set(nombresDeTools());
  return names.filter((n) => validos.has(n));
}

export interface AgentConfigPatch {
  enabled?: boolean;
  /** null vuelve a heredar del global. */
  systemPrompt?: string | null;
  enabledTools?: string[] | null;
  model?: string | null;
}

export async function saveAgentConfig(
  channel: Channel,
  patch: AgentConfigPatch
): Promise<ResolvedAgentConfig | null> {
  const tenantId = await resolveDefaultTenantId();
  if (!tenantId) return null;

  const values = {
    tenantId,
    channel,
    enabled: patch.enabled ?? true,
    systemPrompt: patch.systemPrompt?.trim() || null,
    enabledTools: patch.enabledTools?.length
      ? filterValidTools(patch.enabledTools)
      : null,
    model: patch.model?.trim() || null,
    updatedAt: new Date(),
  };

  await db
    .insert(agentConfigs)
    .values(values)
    .onConflictDoUpdate({
      target: [agentConfigs.tenantId, agentConfigs.channel],
      set: {
        ...(patch.enabled !== undefined ? { enabled: values.enabled } : {}),
        ...(patch.systemPrompt !== undefined
          ? { systemPrompt: values.systemPrompt }
          : {}),
        ...(patch.enabledTools !== undefined
          ? { enabledTools: values.enabledTools }
          : {}),
        ...(patch.model !== undefined ? { model: values.model } : {}),
        updatedAt: values.updatedAt,
      },
    });

  return getAgentConfig(channel);
}

/** Vuelve a heredar todo del global sin borrar el on/off del canal. */
export async function resetAgentConfig(
  channel: Channel
): Promise<ResolvedAgentConfig | null> {
  return saveAgentConfig(channel, {
    systemPrompt: null,
    enabledTools: null,
    model: null,
  });
}

export async function listAgentConfigs(): Promise<ResolvedAgentConfig[]> {
  return Promise.all(CHANNELS.map((c) => getAgentConfig(c)));
}

export { getDefaultSystemPromptTemplate };
