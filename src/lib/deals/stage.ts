import "server-only";
import { db } from "@/db";
import { contacts, deals, pipelineStages, pipelines } from "@/db/schema";
import { eq } from "drizzle-orm";
import { emitAutomationEvent } from "@/lib/automations";
import type { DealStageChangedPayload } from "@/lib/automations/triggers";

/**
 * Mueve una operacion de etapa y emite `deal.stage_changed`.
 *
 * Es el UNICO camino: el drag del kanban (`PUT /api/pipeline`), la edicion de la
 * operacion (`PUT /api/deals/:id`) y la creacion (`POST /api/deals`, con
 * `previousStageId = null`: "lead colocado en el pipeline") pasan todos por aca. Si se
 * escribe `stageId` por otro lado, las automatizaciones no se enteran.
 */
export async function setDealStage(input: {
  dealId: string;
  stageId: string;
  /** Solo para la creacion: la fila ya tiene la etapa, no hay que actualizarla. */
  justCreated?: boolean;
}): Promise<{ ok: boolean; error?: string; changed: boolean }> {
  const [deal] = await db
    .select({
      id: deals.id,
      title: deals.title,
      stageId: deals.stageId,
      contactId: deals.contactId,
    })
    .from(deals)
    .where(eq(deals.id, input.dealId))
    .limit(1);
  if (!deal) return { ok: false, error: "Deal no encontrado", changed: false };

  const [stage] = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.id, input.stageId))
    .limit(1);
  if (!stage) return { ok: false, error: "Etapa no encontrada", changed: false };

  const previousStageId = input.justCreated ? null : deal.stageId;
  if (!input.justCreated && previousStageId === input.stageId) {
    return { ok: true, changed: false };
  }

  if (!input.justCreated) {
    await db
      .update(deals)
      .set({ stageId: input.stageId, updatedAt: new Date() })
      .where(eq(deals.id, deal.id));
  }

  const [pipeline] = await db
    .select({ name: pipelines.name })
    .from(pipelines)
    .where(eq(pipelines.id, stage.pipelineId))
    .limit(1);
  const [previous] = previousStageId
    ? await db
        .select({ name: pipelineStages.name })
        .from(pipelineStages)
        .where(eq(pipelineStages.id, previousStageId))
        .limit(1)
    : [];
  const [contact] = await db
    .select({ name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, deal.contactId))
    .limit(1);

  const payload: DealStageChangedPayload = {
    dealId: deal.id,
    dealTitle: deal.title,
    contactName: contact?.name ?? "",
    pipelineId: stage.pipelineId,
    pipelineName: pipeline?.name ?? "",
    stageId: stage.id,
    stageName: stage.name,
    previousStageId,
    previousStageName: previous?.name ?? null,
  };

  await emitAutomationEvent({
    trigger: "deal.stage_changed",
    contactId: deal.contactId,
    payload: payload as unknown as Record<string, unknown>,
  });

  return { ok: true, changed: true };
}
