import { db } from "@/db";
import { agentJobs, contacts, conversations } from "@/db/schema";
import { and, eq, isNull, lte } from "drizzle-orm";

const DEBOUNCE_MS = 6000;

/**
 * Encola un job para procesar el agente IA.
 * - Si ya hay un job pending para la misma CONVERSACION, NO crea uno nuevo:
 *   solo extiende su `process_after` para "absorber" mensajes en rafaga.
 * - Si no hay, crea uno nuevo.
 *
 * La unidad de debounce es la conversacion, no el contacto: la misma persona puede
 * escribirte por WhatsApp y por Instagram, y son dos hilos que hay que responder por
 * separado. Sin `conversationId` (flujo WhatsApp por Meta, todavia sin migrar) se cae
 * al comportamiento viejo por contacto, aislado de los jobs que si tienen conversacion.
 */
export async function enqueueAgentJob(
  contactId: string,
  triggerMessageId: string,
  conversationId?: string | null
): Promise<{ jobId: string; created: boolean }> {
  const processAfter = new Date(Date.now() + DEBOUNCE_MS);

  const pendingFilter = conversationId
    ? and(
        eq(agentJobs.conversationId, conversationId),
        eq(agentJobs.status, "pending")
      )
    : and(
        eq(agentJobs.contactId, contactId),
        isNull(agentJobs.conversationId),
        eq(agentJobs.status, "pending")
      );

  const [existing] = await db
    .select({ id: agentJobs.id })
    .from(agentJobs)
    .where(pendingFilter)
    .limit(1);

  if (existing) {
    await db
      .update(agentJobs)
      .set({
        processAfter,
        triggerMessageId,
        updatedAt: new Date(),
      })
      .where(eq(agentJobs.id, existing.id));
    return { jobId: existing.id, created: false };
  }

  const [created] = await db
    .insert(agentJobs)
    .values({
      contactId,
      conversationId: conversationId ?? null,
      status: "pending",
      processAfter,
      triggerMessageId,
    })
    .returning({ id: agentJobs.id });

  return { jobId: created.id, created: true };
}

/**
 * Intenta tomar un job para procesar.
 * - Si el job ya no esta pending, no hace nada (otro worker lo tomo).
 * - Si su processAfter aun es futuro, no hace nada (debounce activo, otro setTimeout vendra).
 * - Si OK, marca processing y devuelve el job + contacto.
 */
export async function claimAgentJob(jobId: string): Promise<
  | { ok: true; contactId: string; conversationId: string | null; attempts: number }
  | { ok: false; reason: string }
> {
  const [job] = await db
    .select()
    .from(agentJobs)
    .where(eq(agentJobs.id, jobId))
    .limit(1);

  if (!job) return { ok: false, reason: "job_not_found" };
  if (job.status !== "pending") return { ok: false, reason: `status_${job.status}` };

  const now = Date.now();
  if (job.processAfter.getTime() > now) {
    return { ok: false, reason: "debounce_still_active" };
  }

  // Pre-check rapido del contacto
  const [contact] = await db
    .select({ aiEnabled: contacts.aiEnabled, needsHuman: contacts.needsHuman })
    .from(contacts)
    .where(eq(contacts.id, job.contactId))
    .limit(1);

  if (!contact) {
    await db
      .update(agentJobs)
      .set({ status: "failed", error: "contact_not_found", updatedAt: new Date() })
      .where(eq(agentJobs.id, jobId));
    return { ok: false, reason: "contact_not_found" };
  }

  if (!contact.aiEnabled || contact.needsHuman) {
    await db
      .update(agentJobs)
      .set({
        status: "done",
        error: !contact.aiEnabled ? "ai_disabled" : "needs_human",
        updatedAt: new Date(),
      })
      .where(eq(agentJobs.id, jobId));
    return { ok: false, reason: "bot_off" };
  }

  // El toggle del contacto es el kill-switch global; el de la conversacion apaga el bot
  // en un canal sin apagarlo en los otros (derivar a humano por Instagram no deberia
  // callar al bot en WhatsApp).
  if (job.conversationId) {
    const [conv] = await db
      .select({
        aiEnabled: conversations.aiEnabled,
        needsHuman: conversations.needsHuman,
      })
      .from(conversations)
      .where(eq(conversations.id, job.conversationId))
      .limit(1);

    if (conv && (!conv.aiEnabled || conv.needsHuman)) {
      await db
        .update(agentJobs)
        .set({
          status: "done",
          error: !conv.aiEnabled ? "ai_disabled_conversation" : "needs_human_conversation",
          updatedAt: new Date(),
        })
        .where(eq(agentJobs.id, jobId));
      return { ok: false, reason: "bot_off" };
    }
  }

  // Marcar processing (no usamos transacciones distribuidas; en MVP single-runner alcanza)
  const updated = await db
    .update(agentJobs)
    .set({
      status: "processing",
      attempts: job.attempts + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(agentJobs.id, jobId), eq(agentJobs.status, "pending")))
    .returning({ id: agentJobs.id });

  if (updated.length === 0) {
    return { ok: false, reason: "race_condition" };
  }

  return {
    ok: true,
    contactId: job.contactId,
    conversationId: job.conversationId,
    attempts: job.attempts + 1,
  };
}

export async function markJobDone(
  jobId: string,
  reason?: string
): Promise<void> {
  await db
    .update(agentJobs)
    .set({
      status: "done",
      error: reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(agentJobs.id, jobId));
}

export async function markJobFailed(
  jobId: string,
  error: string
): Promise<void> {
  await db
    .update(agentJobs)
    .set({
      status: "failed",
      error,
      updatedAt: new Date(),
    })
    .where(eq(agentJobs.id, jobId));
}

/**
 * Recoge jobs pendientes vencidos (por si setTimeout fallo o serverless killed
 * el worker). Pensado para llamarse desde un cron periodico.
 */
export async function findStaleJobs(): Promise<
  Array<{ id: string; contactId: string; conversationId: string | null }>
> {
  const rows = await db
    .select({
      id: agentJobs.id,
      contactId: agentJobs.contactId,
      conversationId: agentJobs.conversationId,
    })
    .from(agentJobs)
    .where(and(eq(agentJobs.status, "pending"), lte(agentJobs.processAfter, new Date())))
    .limit(50);
  return rows;
}

export const queueConfig = {
  debounceMs: DEBOUNCE_MS,
};
