import "server-only";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Web Push con VAPID. Va por Google (Chrome/Android) y Apple (iOS 16.4+ con la PWA
 * instalada en la pantalla de inicio) sin Firebase ni cuenta de desarrollador.
 *
 * Reglas que no son obvias:
 *  - Es best-effort. Un push que no llega no es un bug del CRM: el sistema operativo
 *    puede demorarlo o descartarlo. Por eso el push es el AVISO; la asignacion se ve
 *    en el CRM aunque el push nunca llegue.
 *  - Una suscripcion muerta (410/404) se borra en el acto. iOS ademas puede fallar
 *    SIN status: tambien se trata como muerta, si no se acumulan filas que nunca
 *    entregan.
 *  - 429 y 5xx no borran: es el proveedor pidiendo calma.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

export function hasVapidKeys(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  /** Ruta a abrir al tocar la notificacion (relativa: "/contacts/abc"). */
  url?: string;
  /** Agrupa notificaciones del mismo asunto: la nueva reemplaza a la anterior. */
  tag?: string;
}

export interface PushOutcome {
  sent: number;
  failed: number;
  removed: number;
  /** No habia ningun dispositivo suscripto para ese miembro. */
  noDevices: boolean;
}

export async function sendPushToMember(
  memberId: string,
  payload: PushPayload
): Promise<PushOutcome> {
  const outcome: PushOutcome = { sent: 0, failed: 0, removed: 0, noDevices: false };

  if (!ensureConfigured()) {
    throw new Error(
      "Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. Generarlas con `npx web-push generate-vapid-keys`."
    );
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.memberId, memberId));

  if (subs.length === 0) {
    outcome.noDevices = true;
    return outcome;
  }

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60, urgency: "high" }
        );
        outcome.sent++;
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        const dead = status === 404 || status === 410 || status === undefined;
        if (dead) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          outcome.removed++;
        } else {
          outcome.failed++;
          console.warn(
            `[push] fallo envio a ${sub.endpoint.slice(0, 40)}... status=${status}`,
            err instanceof Error ? err.message : err
          );
        }
      }
    })
  );

  return outcome;
}

export async function saveSubscription(input: {
  memberId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      memberId: input.memberId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: [pushSubscriptions.memberId, pushSubscriptions.endpoint],
      set: {
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      },
    });
}

export async function removeSubscription(
  memberId: string,
  endpoint: string
): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.memberId, memberId),
        eq(pushSubscriptions.endpoint, endpoint)
      )
    );
}

export async function countSubscriptions(memberId: string): Promise<number> {
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.memberId, memberId));
  return rows.length;
}
