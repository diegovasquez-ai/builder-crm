import "server-only";
import { emitContactCreated } from "@/lib/contacts/events";
import { db } from "@/db";
import {
  activities,
  contactIdentities,
  contacts,
  conversations,
  messages,
} from "@/db/schema";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { normalizePhone } from "@/lib/phone";
import { enqueueAgentJob } from "@/lib/agent/queue";
import { CHANNEL_LABELS, type Channel, type Provider } from "./types";

/**
 * Ingesta de mensajes entrantes/salientes de cualquier canal.
 *
 * Lo que NO se puede reusar del webhook de WhatsApp es la resolucion de identidad:
 * ese hace `findOrCreateContact(phone)` y en Instagram/Messenger no hay telefono, solo
 * un IGSID/PSID. De ahi la tabla `contact_identities`.
 */

const REACTIVATION_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000;

/** No encolar al agente para mensajes viejos: protege al backfill de contestar historial. */
const MAX_AGE_FOR_AGENT_MS = 60 * 60 * 1000;

/**
 * Ventana para reconocer el eco de un mensaje propio. Dos minutos alcanzan de sobra
 * para el ida y vuelta con el proveedor, y es lo bastante corta como para no confundir
 * con un mensaje real que un humano escribio igual desde el celular mas tarde.
 */
const ECHO_WINDOW_MS = 2 * 60 * 1000;

const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

// ============================================================
// Identidad
// ============================================================

export interface IdentityInput {
  tenantId: string;
  channel: Channel;
  /** IGSID | PSID | telefono E.164. */
  externalId: string;
  handle?: string | null;
  name?: string | null;
}

function placeholderName(input: IdentityInput): string {
  if (input.handle) return `@${input.handle.replace(/^@/, "")}`;
  const label = CHANNEL_LABELS[input.channel];
  const tail = input.externalId.slice(-4);
  return `${label} ${tail}`;
}

function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return true;
  return /^(WhatsApp|Instagram|Messenger|Facebook)\s+\S{2,8}$/i.test(name.trim());
}

/**
 * Resuelve el contacto de una identidad social, creandolo si hace falta.
 *
 * En WhatsApp, ademas de `contact_identities`, se intenta matchear por telefono para
 * no duplicar los contactos que ya existen del flujo de Meta directo.
 */
export async function findOrCreateContactByIdentity(
  input: IdentityInput
): Promise<string> {
  const [identity] = await db
    .select({ contactId: contactIdentities.contactId })
    .from(contactIdentities)
    .where(
      and(
        eq(contactIdentities.channel, input.channel),
        eq(contactIdentities.externalId, input.externalId)
      )
    )
    .limit(1);

  if (identity) {
    await maybeImproveName(identity.contactId, input.name);
    return identity.contactId;
  }

  const phone =
    input.channel === "whatsapp" ? `+${normalizePhone(input.externalId)}` : null;

  if (phone) {
    const [byPhone] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.phone, phone), eq(contacts.tenantId, input.tenantId)))
      .limit(1);

    if (byPhone) {
      await linkIdentity(byPhone.id, input);
      await maybeImproveName(byPhone.id, input.name);
      return byPhone.id;
    }
  }

  const now = new Date();
  const [created] = await db
    .insert(contacts)
    .values({
      name: input.name?.trim() || placeholderName(input),
      phone,
      source: input.channel,
      score: 50,
      tenantId: input.tenantId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: contacts.id });

  await linkIdentity(created.id, input);

  await db.insert(activities).values({
    type: "note",
    description: `Nuevo contacto via ${CHANNEL_LABELS[input.channel]} (escribio primero)`,
    contactId: created.id,
    createdAt: now,
  });

  await emitContactCreated(created.id, {
    name: input.name?.trim() || placeholderName(input),
    source: input.channel,
    channel: input.channel,
  });

  return created.id;
}

/**
 * Segunda identidad para un contacto que ya existe. El caso real es el BSUID de
 * WhatsApp: un mismo cliente puede llegar por telefono hoy y por BSUID manana.
 */
export async function linkExtraIdentity(
  contactId: string,
  channel: Channel,
  externalId: string,
  handle?: string | null
): Promise<void> {
  await db
    .insert(contactIdentities)
    .values({ contactId, channel, externalId, handle: handle ?? null })
    .onConflictDoNothing();
}

async function linkIdentity(contactId: string, input: IdentityInput): Promise<void> {
  await db
    .insert(contactIdentities)
    .values({
      contactId,
      channel: input.channel,
      externalId: input.externalId,
      handle: input.handle ?? null,
    })
    .onConflictDoNothing();
}

/** Solo pisa nombres placeholder: no sobrescribe uno que puso una persona. */
async function maybeImproveName(
  contactId: string,
  name: string | null | undefined
): Promise<void> {
  const clean = name?.trim();
  if (!clean) return;

  const [row] = await db
    .select({ name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!row || !isPlaceholderName(row.name)) return;

  await db
    .update(contacts)
    .set({ name: clean, updatedAt: new Date() })
    .where(eq(contacts.id, contactId));
}

// ============================================================
// Conversaciones
// ============================================================

export interface UpsertConversationInput {
  tenantId: string;
  contactId: string;
  accountId: string | null;
  channel: Channel;
  provider: Provider;
  /** conversationId del proveedor. */
  externalId: string;
  participantId?: string | null;
  participantName?: string | null;
  participantHandle?: string | null;
  participantPicture?: string | null;
  metadata?: unknown;
}

export async function upsertConversation(
  input: UpsertConversationInput
): Promise<typeof conversations.$inferSelect> {
  const now = new Date();

  const [row] = await db
    .insert(conversations)
    .values({
      tenantId: input.tenantId,
      contactId: input.contactId,
      accountId: input.accountId,
      channel: input.channel,
      provider: input.provider,
      externalId: input.externalId,
      participantId: input.participantId ?? null,
      participantName: input.participantName ?? null,
      participantHandle: input.participantHandle ?? null,
      participantPicture: input.participantPicture ?? null,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [conversations.provider, conversations.externalId],
      set: {
        contactId: input.contactId,
        accountId: input.accountId,
        participantName: input.participantName ?? null,
        participantHandle: input.participantHandle ?? null,
        participantPicture: input.participantPicture ?? null,
        // metadata solo se pisa si viene con algo: los eventos de mensaje no la traen
        // y no queremos perder la atribucion capturada en conversation.started.
        ...(input.metadata ? { metadata: input.metadata } : {}),
        updatedAt: now,
      },
    })
    .returning();

  return row;
}

/** Hilo mas reciente de un contacto en un canal. */
export async function findConversationForContact(
  contactId: string,
  channel: Channel
): Promise<typeof conversations.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.contactId, contactId),
        eq(conversations.channel, channel)
      )
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);
  return row ?? null;
}

// ============================================================
// Mensajes
// ============================================================

export interface IngestMessageInput {
  conversation: typeof conversations.$inferSelect;
  direction: "in" | "out";
  externalId: string | null;
  body: string | null;
  type?: string;
  sentAt?: Date | null;
  status?: string;
  rawPayload?: unknown;
  /** El backfill lo pasa en false para no contestarle a cientos de hilos viejos. */
  enqueueAgent?: boolean;
}

export interface IngestMessageResult {
  duplicate: boolean;
  messageId: string | null;
  jobId: string | null;
}

export async function ingestMessage(
  input: IngestMessageInput
): Promise<IngestMessageResult> {
  const { conversation: conv } = input;
  const sentAt = input.sentAt ?? new Date();

  if (input.externalId) {
    const [existing] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.externalId, input.externalId))
      .limit(1);
    if (existing) return { duplicate: true, messageId: existing.id, jobId: null };
  }

  // Eco de un mensaje que mando el propio CRM.
  //
  // Zernio dispara `message.sent` por CADA mensaje que sale, incluidos los que
  // acabamos de enviar nosotros. Normalmente el chequeo de arriba lo frena, porque
  // `deliverMessage` guarda el external_id que devuelve el envio. Pero hay una ventana:
  // entre que se inserta la fila optimista y que llega la respuesta del proveedor, esa
  // fila tiene external_id NULL. Si el webhook entra en ese hueco, el indice unico no
  // aplica (es parcial) y el mensaje termina duplicado en la bandeja.
  //
  // En vez de insertar otro, se adopta el que ya esta: se le pega el id que faltaba.
  if (input.direction === "out" && input.externalId && input.body) {
    const [propio] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conv.id),
          eq(messages.direction, "out"),
          isNull(messages.externalId),
          eq(messages.body, input.body),
          gte(messages.createdAt, new Date(Date.now() - ECHO_WINDOW_MS))
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);

    if (propio) {
      await db
        .update(messages)
        .set({ externalId: input.externalId, status: input.status ?? "sent" })
        .where(eq(messages.id, propio.id));
      return { duplicate: true, messageId: propio.id, jobId: null };
    }
  }

  let messageId: string;
  try {
    const [inserted] = await db
      .insert(messages)
      .values({
        contactId: conv.contactId,
        conversationId: conv.id,
        channel: conv.channel,
        provider: conv.provider,
        direction: input.direction,
        type: input.type ?? "text",
        body: input.body,
        externalId: input.externalId,
        status: input.status ?? (input.direction === "in" ? "received" : "sent"),
        rawPayload: input.rawPayload ?? null,
        tenantId: conv.tenantId,
        sentAt,
        createdAt: new Date(),
      })
      .returning({ id: messages.id });
    messageId = inserted.id;
  } catch (err) {
    // El indice unico sobre external_id es la idempotencia real: si dos entregas del
    // mismo evento corren en paralelo, el SELECT de arriba puede no verlas.
    if (isUniqueViolation(err)) {
      return { duplicate: true, messageId: null, jobId: null };
    }
    throw err;
  }

  await touchConversation(conv.id, {
    direction: input.direction,
    body: input.body,
    sentAt,
  });

  if (input.direction !== "in") {
    return { duplicate: false, messageId, jobId: null };
  }

  await maybeReactivateAfterInactivity(conv.id, conv.contactId);

  const tooOld = Date.now() - sentAt.getTime() > MAX_AGE_FOR_AGENT_MS;
  const shouldEnqueue = (input.enqueueAgent ?? true) && !tooOld;
  if (!shouldEnqueue || !conv.contactId) {
    return { duplicate: false, messageId, jobId: null };
  }

  const { jobId } = await enqueueAgentJob(
    conv.contactId,
    input.externalId ?? messageId,
    conv.id
  );
  return { duplicate: false, messageId, jobId };
}

/** Mantiene al dia los campos materializados del hilo (lista + ventana de 24h). */
export async function touchConversation(
  conversationId: string,
  last: { direction: "in" | "out"; body: string | null; sentAt: Date }
): Promise<void> {
  await db
    .update(conversations)
    .set({
      lastMessageAt: last.sentAt,
      lastMessageBody: last.body,
      lastDirection: last.direction,
      ...(last.direction === "in"
        ? {
            lastInboundAt: last.sentAt,
            unreadCount: sql`${conversations.unreadCount} + 1`,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));
}

/**
 * Si el bot esta apagado en esta conversacion y no hubo actividad en mas de una semana,
 * se vuelve a prender. Portado del webhook de WhatsApp, pero por conversacion: derivar
 * a un humano en Instagram no deberia reactivar (ni apagar) el bot de WhatsApp.
 */
async function maybeReactivateAfterInactivity(
  conversationId: string,
  contactId: string | null
): Promise<void> {
  const [conv] = await db
    .select({
      aiEnabled: conversations.aiEnabled,
      needsHuman: conversations.needsHuman,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv) return;
  if (conv.aiEnabled && !conv.needsHuman) return;

  const [lastMsg] = await db
    .select({ sentAt: messages.sentAt, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(1);

  const lastTs = (lastMsg?.sentAt ?? lastMsg?.createdAt)?.getTime();
  if (!lastTs) return;
  if (Date.now() - lastTs < REACTIVATION_INACTIVITY_MS) return;

  await db
    .update(conversations)
    .set({
      aiEnabled: true,
      needsHuman: false,
      needsHumanReason: null,
      needsHumanAt: null,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));

  if (contactId) {
    await db.insert(activities).values({
      type: "note",
      description: "Bot reactivado automaticamente por inactividad (7 dias)",
      contactId,
      createdAt: new Date(),
    });
  }
}

export interface MessageStatusUpdate {
  externalId: string;
  status?: string;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  errorMessage?: string | null;
}

/**
 * @returns false si el mensaje todavia no existe. Los eventos de estado pueden llegar
 * antes que el mensaje: el llamador reintenta en vez de perder el evento en silencio
 * (que es lo que hace hoy el webhook de WhatsApp).
 */
export async function updateMessageStatus(
  update: MessageStatusUpdate
): Promise<boolean> {
  const [target] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.externalId, update.externalId))
    .limit(1);

  if (!target) return false;

  await db
    .update(messages)
    .set({
      ...(update.status ? { status: update.status } : {}),
      ...(update.deliveredAt ? { deliveredAt: update.deliveredAt } : {}),
      ...(update.readAt ? { readAt: update.readAt } : {}),
      ...(update.errorMessage !== undefined
        ? { errorMessage: update.errorMessage }
        : {}),
    })
    .where(eq(messages.id, target.id));

  return true;
}
