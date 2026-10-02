import "server-only";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { sendPushToMember, type PushOutcome } from "@/lib/push";

/**
 * Notificaciones a miembros del equipo. Dos canales, siempre juntos:
 *
 *   1. Interna (tabla `notifications`): la campanita del CRM. Siempre se escribe.
 *   2. Push (Web Push al telefono): best-effort, solo si el miembro activo un dispositivo.
 *
 * Si el push no llega, la interna queda. Por eso "me llego la notificacion" no depende
 * de que el asesor haya instalado la PWA.
 */

export interface NotifyInput {
  memberId: string;
  title: string;
  body?: string;
  /** Ruta relativa a abrir al tocarla. */
  url?: string;
  contactId?: string | null;
  kind?: string;
  /** Agrupa pushes del mismo asunto (el nuevo reemplaza al anterior en el telefono). */
  tag?: string;
}

export interface NotifyOutcome {
  notificationId: string;
  push: PushOutcome | { error: string };
}

export async function notifyMember(input: NotifyInput): Promise<NotifyOutcome> {
  const [row] = await db
    .insert(notifications)
    .values({
      memberId: input.memberId,
      kind: input.kind ?? "automation",
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      contactId: input.contactId ?? null,
    })
    .returning({ id: notifications.id });

  let push: NotifyOutcome["push"];
  try {
    push = await sendPushToMember(input.memberId, {
      title: input.title,
      body: input.body ?? "",
      url: input.url,
      tag: input.tag,
    });
  } catch (err) {
    push = { error: err instanceof Error ? err.message : "push fallo" };
  }

  return { notificationId: row.id, push };
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  contactId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export async function listNotifications(
  memberId: string,
  limit = 20
): Promise<{ items: NotificationItem[]; unread: number }> {
  const [items, [{ unread }]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        url: notifications.url,
        contactId: notifications.contactId,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.memberId, memberId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.memberId, memberId), isNull(notifications.readAt))),
  ]);
  return { items, unread };
}

/** Marca leidas: las indicadas, o todas las del miembro si no se pasan ids. */
export async function markNotificationsRead(
  memberId: string,
  ids?: string[]
): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.memberId, memberId),
        isNull(notifications.readAt),
        ids && ids.length > 0 ? inArray(notifications.id, ids) : undefined
      )
    )
    .returning({ id: notifications.id });
  return rows.length;
}
