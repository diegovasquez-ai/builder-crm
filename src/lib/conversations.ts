import "server-only";
import { db } from "@/db";
import { channelAccounts, contacts, conversations, messages } from "@/db/schema";
import { and, asc, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { isChannel, type Channel } from "@/lib/channels/types";

/**
 * Capa de lectura del inbox.
 *
 * Antes una "conversacion" era una proyeccion de `contacts ⟕ ultimo mensaje`, agrupada
 * por contacto. Con tres canales eso colapsaba los hilos: la misma persona escribiendo
 * por WhatsApp y por Instagram quedaba en un solo chat mezclado. Ahora se lee de la
 * tabla `conversations`, que ademas trae `unread_count` y `last_*` materializados: la
 * lista pasa de N+1 queries a una sola.
 */

export interface ConversationListItem {
  conversationId: string;
  contactId: string | null;
  name: string;
  channel: Channel;
  provider: string;
  /** Telefono en WhatsApp, @usuario en Instagram, nombre en Messenger. */
  handle: string | null;
  phone: string | null;
  participantPicture: string | null;
  lastBody: string | null;
  lastDirection: "in" | "out" | null;
  lastAt: Date | null;
  unreadCount: number;
  /** Efectivo: el contacto es el kill-switch global, la conversacion apaga un canal. */
  aiEnabled: boolean;
  needsHuman: boolean;
  needsHumanReason: string | null;
}

export interface ConversationMessage {
  id: string;
  direction: "in" | "out";
  type: string;
  body: string | null;
  templateName: string | null;
  status: string;
  errorMessage: string | null;
  externalId: string | null;
  metaMessageId: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface ConversationDetail {
  conversationId: string;
  channel: Channel;
  provider: string;
  handle: string | null;
  participantName: string | null;
  participantPicture: string | null;
  /** Ultimo entrante: define la ventana de 24h del lado del servidor. */
  lastInboundAt: Date | null;
  aiEnabled: boolean;
  needsHuman: boolean;
  needsHumanReason: string | null;
  metadata: unknown;
}

function toChannel(value: string): Channel {
  return isChannel(value) ? value : "whatsapp";
}

function handleOf(row: {
  channel: string;
  participantHandle: string | null;
  participantId: string | null;
  phone: string | null;
}): string | null {
  if (row.channel === "whatsapp") return row.participantId ?? row.phone;
  if (row.participantHandle) return `@${row.participantHandle.replace(/^@/, "")}`;
  return row.participantId;
}

export async function listConversations(filter?: {
  channel?: Channel;
  /** Solo hilos de contactos con este propietario (visibilidad de asesor). */
  ownerId?: string;
}): Promise<ConversationListItem[]> {
  const base = db
    .select({
      conversationId: conversations.id,
      contactId: conversations.contactId,
      channel: conversations.channel,
      provider: conversations.provider,
      participantHandle: conversations.participantHandle,
      participantId: conversations.participantId,
      participantName: conversations.participantName,
      participantPicture: conversations.participantPicture,
      lastBody: conversations.lastMessageBody,
      lastDirection: conversations.lastDirection,
      lastAt: conversations.lastMessageAt,
      unreadCount: conversations.unreadCount,
      convAiEnabled: conversations.aiEnabled,
      convNeedsHuman: conversations.needsHuman,
      convNeedsHumanReason: conversations.needsHumanReason,
      contactName: contacts.name,
      phone: contacts.phone,
      contactAiEnabled: contacts.aiEnabled,
      contactNeedsHuman: contacts.needsHuman,
      contactNeedsHumanReason: contacts.needsHumanReason,
    })
    .from(conversations)
    .leftJoin(contacts, eq(contacts.id, conversations.contactId))
    .leftJoin(channelAccounts, eq(channelAccounts.id, conversations.accountId));

  // Los hilos de una cuenta desconectada no se muestran.
  //
  // Al desconectar una cuenta y conectar otra, sus conversaciones seguian apareciendo
  // en la bandeja: parecian activas, pero responderlas fallaba porque la cuenta ya no
  // existe del lado del proveedor. No se borran — si se vuelve a conectar la misma
  // cuenta, el historial reaparece solo. Para eliminarlas de verdad esta
  // `npm run channels:purge`.
  //
  // Las conversaciones sin cuenta asociada (historicas, o de otro proveedor) se
  // muestran igual: no hay ninguna cuenta que las invalide.
  const soloConectadas = or(
    isNull(conversations.accountId),
    isNull(channelAccounts.id),
    ne(channelAccounts.status, "disconnected")
  );

  const rows = await base
    .where(
      and(
        soloConectadas,
        filter?.channel ? eq(conversations.channel, filter.channel) : undefined,
        // Un asesor ve solo los hilos de sus contactos. Los hilos sin contacto
        // (raros: llegaron antes de crear el contacto) los ve solo el admin.
        filter?.ownerId ? eq(contacts.ownerId, filter.ownerId) : undefined
      )
    )
    .orderBy(desc(conversations.lastMessageAt));

  return rows.map((r) => ({
    conversationId: r.conversationId,
    contactId: r.contactId,
    name: r.contactName ?? r.participantName ?? "Sin nombre",
    channel: toChannel(r.channel),
    provider: r.provider,
    handle: handleOf(r),
    phone: r.phone,
    participantPicture: r.participantPicture,
    lastBody: r.lastBody,
    lastDirection: (r.lastDirection as "in" | "out" | null) ?? null,
    lastAt: r.lastAt,
    unreadCount: r.unreadCount,
    aiEnabled: (r.contactAiEnabled ?? true) && r.convAiEnabled,
    needsHuman: (r.contactNeedsHuman ?? false) || r.convNeedsHuman,
    needsHumanReason: r.convNeedsHumanReason ?? r.contactNeedsHumanReason ?? null,
  }));
}

export async function getConversation(conversationId: string): Promise<{
  conversation: ConversationDetail | null;
  contact: typeof contacts.$inferSelect | null;
  messages: ConversationMessage[];
}> {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) return { conversation: null, contact: null, messages: [] };

  const [contact] = conv.contactId
    ? await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, conv.contactId))
        .limit(1)
    : [];

  const rows = await db
    .select({
      id: messages.id,
      direction: messages.direction,
      type: messages.type,
      body: messages.body,
      templateName: messages.templateName,
      status: messages.status,
      errorMessage: messages.errorMessage,
      externalId: messages.externalId,
      metaMessageId: messages.metaMessageId,
      sentAt: messages.sentAt,
      deliveredAt: messages.deliveredAt,
      readAt: messages.readAt,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.sentAt), asc(messages.createdAt));

  return {
    conversation: {
      conversationId: conv.id,
      channel: toChannel(conv.channel),
      provider: conv.provider,
      handle: handleOf({
        channel: conv.channel,
        participantHandle: conv.participantHandle,
        participantId: conv.participantId,
        phone: contact?.phone ?? null,
      }),
      participantName: conv.participantName,
      participantPicture: conv.participantPicture,
      lastInboundAt: conv.lastInboundAt,
      aiEnabled: (contact?.aiEnabled ?? true) && conv.aiEnabled,
      needsHuman: (contact?.needsHuman ?? false) || conv.needsHuman,
      needsHumanReason: conv.needsHumanReason ?? contact?.needsHumanReason ?? null,
      metadata: conv.metadata,
    },
    contact: contact ?? null,
    messages: rows.map((m) => ({
      ...m,
      direction: m.direction as "in" | "out",
    })),
  };
}

export async function markConversationAsRead(
  conversationId: string
): Promise<void> {
  await db
    .update(messages)
    .set({ status: "read", readAt: new Date() })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.direction, "in"),
        eq(messages.status, "received")
      )
    );

  await db
    .update(conversations)
    .set({ unreadCount: 0, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

/** Todos los hilos de un contacto, para el panel de detalle. */
export async function listConversationsForContact(
  contactId: string
): Promise<Array<{ conversationId: string; channel: Channel; lastAt: Date | null }>> {
  const rows = await db
    .select({
      conversationId: conversations.id,
      channel: conversations.channel,
      lastAt: conversations.lastMessageAt,
    })
    .from(conversations)
    .where(eq(conversations.contactId, contactId))
    .orderBy(desc(conversations.lastMessageAt));

  return rows.map((r) => ({ ...r, channel: toChannel(r.channel) }));
}

/**
 * Retrocompatibilidad de links viejos: `/conversations/<contactId>` sigue funcionando.
 * Devuelve el id de conversacion si el parametro era un contacto.
 */
export async function resolveConversationId(
  id: string
): Promise<string | null> {
  const [asConversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  if (asConversation) return asConversation.id;

  const [byContact] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.contactId, id))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);

  return byContact?.id ?? null;
}

export async function countUnreadByChannel(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      channel: conversations.channel,
      total: sql<number>`COUNT(*)::int`,
    })
    .from(conversations)
    .groupBy(conversations.channel);

  return Object.fromEntries(rows.map((r) => [r.channel, Number(r.total)]));
}

/**
 * Borra un hilo y todo lo que cuelga de el.
 *
 * `messages` y `agent_jobs` se van por cascade (FK con ON DELETE CASCADE). NO se toca
 * el contacto ni `contact_identities`: la persona sigue en el CRM y, si vuelve a
 * escribir, la ingesta crea un hilo nuevo y lo engancha al mismo contacto. Tampoco se
 * tocan `webhook_events`: son el registro de lo que entrego el proveedor y sirven de
 * idempotencia; borrarlos haria que un reintento reinsertara los mensajes.
 *
 * No se puede deshacer: el historial de esa conversacion se pierde para siempre.
 */
export async function deleteConversation(conversationId: string): Promise<{
  deleted: boolean;
  messages: number;
}> {
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));

  const rows = await db
    .delete(conversations)
    .where(eq(conversations.id, conversationId))
    .returning({ id: conversations.id });

  return { deleted: rows.length > 0, messages: count };
}
