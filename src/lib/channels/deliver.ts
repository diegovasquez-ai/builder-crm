import "server-only";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAccountById } from "./accounts";
import { conectorParaConversacion } from "./conectores";
import type { ConversationRow, OutboundMessage } from "./conector";
import { touchConversation } from "./ingest";
import type { Channel } from "./types";

/**
 * Unico camino de salida del sistema: envia por el conector de la conversacion y
 * persiste. Nada mas sale a la red: el agente, el chat y las plantillas pasan por aqui.
 */

export interface DeliverResult {
  ok: boolean;
  messageId: string | null;
  externalId?: string | null;
  error?: string;
  hint?: string;
}

export type DeliverOrigin = "agent" | "human" | "template";

export async function getConversationRow(
  conversationId: string
): Promise<ConversationRow | null> {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row ?? null;
}

export async function deliverMessage(
  conversationId: string,
  msg: OutboundMessage,
  origin: DeliverOrigin = "human"
): Promise<DeliverResult> {
  const conversation = await getConversationRow(conversationId);
  if (!conversation) {
    return { ok: false, messageId: null, error: "conversation_not_found" };
  }

  const conector = conectorParaConversacion(conversation);
  if (!conector) {
    return {
      ok: false,
      messageId: null,
      error: `sin conector para el proveedor "${conversation.provider}"`,
    };
  }

  const body = bodyOf(msg);
  if (!body) {
    return { ok: false, messageId: null, error: "mensaje vacio" };
  }

  // Fila optimista antes de salir a la red: si el proveedor tarda o falla, el mensaje
  // ya esta en el hilo y el usuario ve el estado real en vez de que desaparezca.
  const [pending] = await db
    .insert(messages)
    .values({
      contactId: conversation.contactId,
      conversationId: conversation.id,
      channel: conversation.channel,
      provider: conversation.provider,
      direction: "out",
      origin,
      type: msg.template ? "template" : "text",
      body,
      templateName: msg.template?.name ?? null,
      status: "pending",
      tenantId: conversation.tenantId,
      toPhone:
        conversation.channel === "whatsapp" ? conversation.participantId : null,
      sentAt: new Date(),
      createdAt: new Date(),
    })
    .returning({ id: messages.id });

  const account = await getAccountById(conversation.accountId);
  const outcome = await conector.enviar(
    { conversation, account, channel: conversation.channel as Channel },
    msg
  );

  if (!outcome.success) {
    const errorText = outcome.error?.message ?? "error desconocido";
    await db
      .update(messages)
      .set({ status: "failed", errorMessage: JSON.stringify(outcome.error ?? {}) })
      .where(eq(messages.id, pending.id));

    console.error(
      `[deliver] fallo el envio (${origin}, ${conversation.channel}/${conversation.provider}):`,
      errorText
    );
    return {
      ok: false,
      messageId: pending.id,
      error: errorText,
      hint: outcome.hint,
    };
  }

  await db
    .update(messages)
    .set({ status: "sent", externalId: outcome.externalId ?? null })
    .where(eq(messages.id, pending.id));

  await touchConversation(conversation.id, {
    direction: "out",
    body,
    sentAt: new Date(),
  });

  return {
    ok: true,
    messageId: pending.id,
    externalId: outcome.externalId ?? null,
  };
}

/**
 * Persistencia de un saliente que ya se envio por fuera del adapter.
 *
 * Lo usa el agente cuando le inyectan un sender propio (el experimento de GHL): el
 * transporte es ajeno pero la fila tiene que quedar igual de bien formada que el resto.
 */
export async function persistOutbound(
  conversation: ConversationRow,
  body: string,
  externalId: string | null
): Promise<string> {
  const now = new Date();
  const [row] = await db
    .insert(messages)
    .values({
      contactId: conversation.contactId,
      conversationId: conversation.id,
      channel: conversation.channel,
      provider: conversation.provider,
      direction: "out",
      origin: "human",
      type: "text",
      body,
      externalId,
      status: "sent",
      tenantId: conversation.tenantId,
      sentAt: now,
      createdAt: now,
    })
    .returning({ id: messages.id });

  await touchConversation(conversation.id, {
    direction: "out",
    body,
    sentAt: now,
  });

  return row.id;
}

function bodyOf(msg: OutboundMessage): string | null {
  if (msg.text?.trim()) return msg.text.trim();
  if (msg.template) {
    return msg.template.previewText?.trim() || `[plantilla] ${msg.template.name}`;
  }
  return null;
}
