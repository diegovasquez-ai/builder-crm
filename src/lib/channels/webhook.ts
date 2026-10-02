import "server-only";
import crypto from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { and, asc, eq, lt } from "drizzle-orm";
import type { Conector } from "./conector";

/**
 * Mecanica generica de webhooks para cualquier conector:
 *
 *   POST -> manejarWebhook(conector, req)   verifica firma, reclama el evento
 *                                            (idempotencia), responde 2xx, procesa en after()
 *   GET  -> barrerWebhook(conector, req)     reprocesa lo que quedo colgado (con secreto)
 *
 * Los proveedores entregan at-least-once: el claim en `webhook_events` descarta los
 * reintentos. Pero si el `after()` muere, el evento queda reclamado y nadie lo vuelve a
 * ver; por eso el payload se guarda y el barrido lo reintenta hasta MAX_ATTEMPTS.
 *
 * Este modulo importa lo minimo (db, crypto). Lo pesado entra por `import()` dentro de
 * `conector.webhook.procesar`.
 */

const STALE_AFTER_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export async function manejarWebhook(conector: Conector, request: NextRequest): Promise<NextResponse> {
  if (!conector.webhook) {
    return NextResponse.json({ error: "Este conector no recibe webhooks" }, { status: 404 });
  }

  const rawBody = await request.text();

  if (!conector.webhook.verificar(rawBody, request.headers)) {
    console.warn(`[webhook ${conector.id}] firma invalida`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId =
    conector.webhook.idEvento(rawBody, request.headers, payload) ??
    `sha:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;

  const claimed = await db
    .insert(webhookEvents)
    .values({
      eventId,
      provider: conector.id,
      event: nombreEvento(payload),
      status: "received",
      payload: payload as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ eventId: webhookEvents.eventId });

  if (claimed.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const headers = new Headers(request.headers);
  after(async () => {
    await ejecutarEvento(conector, eventId, payload, headers);
  });

  return NextResponse.json({ received: true });
}

export async function barrerWebhook(conector: Conector, request: NextRequest): Promise<NextResponse> {
  if (!autorizadoPorSecreto(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!conector.webhook) {
    return NextResponse.json({ ok: true, found: 0, reprocessed: 0 });
  }

  const stale = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.status, "received"),
        eq(webhookEvents.provider, conector.id),
        lt(webhookEvents.receivedAt, new Date(Date.now() - STALE_AFTER_MS))
      )
    )
    .orderBy(asc(webhookEvents.receivedAt))
    .limit(20);

  let reprocessed = 0;
  for (const row of stale) {
    if (row.attempts >= MAX_ATTEMPTS) {
      await db
        .update(webhookEvents)
        .set({ status: "failed", error: `sin procesar tras ${row.attempts} intentos`, processedAt: new Date() })
        .where(eq(webhookEvents.eventId, row.eventId));
      continue;
    }
    if (!row.payload) continue;
    await ejecutarEvento(conector, row.eventId, row.payload, request.headers);
    reprocessed++;
  }

  return NextResponse.json({ ok: true, found: stale.length, reprocessed });
}

/**
 * Los crons de Vercel solo mandan `Authorization: Bearer`; el worker del agente acepta
 * tambien `x-agent-secret`. Sin AGENT_WORKER_SECRET configurado el barrido queda abierto
 * (no recomendado en produccion; .env.example lo explica).
 */
export function autorizadoPorSecreto(request: NextRequest): boolean {
  const secret = process.env.AGENT_WORKER_SECRET;
  if (!secret) return true;
  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-agent-secret");
  return provided === secret;
}

async function ejecutarEvento(conector: Conector, eventId: string, payload: unknown, headers: Headers): Promise<void> {
  try {
    const result = await conector.webhook!.procesar(payload);

    if (result.status === "retry") {
      // Fuera de orden (tipico: `delivered` antes de que exista el mensaje). Queda en
      // 'received' para que el barrido lo reintente.
      await db
        .update(webhookEvents)
        .set({ attempts: (await intentos(eventId)) + 1, error: result.reason ?? null })
        .where(eq(webhookEvents.eventId, eventId));
      return;
    }

    await db
      .update(webhookEvents)
      .set({ status: result.status, error: result.reason ?? null, processedAt: new Date() })
      .where(eq(webhookEvents.eventId, eventId));

    if (result.jobIds.length > 0) {
      const { triggerAgentWorker, getWorkerBaseUrl } = await import("@/lib/agent/trigger");
      await triggerAgentWorker(result.jobIds, getWorkerBaseUrl(headers), `${conector.id}-webhook`);
    }
  } catch (err) {
    console.error(`[webhook ${conector.id}] error procesando evento`, eventId, err);
    await db
      .update(webhookEvents)
      .set({ status: "failed", error: err instanceof Error ? err.message : "error desconocido", processedAt: new Date() })
      .where(eq(webhookEvents.eventId, eventId))
      .catch(() => {});
  }
}

async function intentos(eventId: string): Promise<number> {
  const [row] = await db
    .select({ attempts: webhookEvents.attempts })
    .from(webhookEvents)
    .where(eq(webhookEvents.eventId, eventId))
    .limit(1);
  return row?.attempts ?? 0;
}

function nombreEvento(payload: unknown): string | null {
  const e = (payload as { event?: unknown } | null)?.event;
  return typeof e === "string" ? e : null;
}
