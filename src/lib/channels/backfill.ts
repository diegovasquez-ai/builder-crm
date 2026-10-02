import "server-only";
import { iterateConversations, listMessages } from "@/lib/zernio/inbox";
import { hasZernioKey } from "@/lib/zernio/client";
import { normalizePhone } from "@/lib/phone";
import { getAccountByZernioId } from "./accounts";
import {
  findOrCreateContactByIdentity,
  ingestMessage,
  upsertConversation,
} from "./ingest";
import { isChannel, type Channel } from "./types";
import type { ZernioConversation, ZernioInboxMessage } from "@/lib/zernio/types";

/**
 * Importa el historial que Zernio ya tiene replicado.
 *
 * Al conectar una cuenta, Zernio copia hasta 500 conversaciones y los 500 mensajes mas
 * nuevos de cada una, pero **eso no llega por webhook**: sin este paso el CRM arranca
 * vacio aunque el historial exista del otro lado.
 *
 * REGLA DURA: nunca encola al agente. Importar 500 hilos con el bot prendido seria
 * mandarle una respuesta automatica a cientos de clientes viejos. `ingestMessage`
 * ademas descarta por antiguedad, o sea que hay dos cinturones.
 */

export interface BackfillOptions {
  /** Limitar a un canal. Por defecto importa todos los conectados. */
  channel?: Channel;
  /** Tope de conversaciones a recorrer. */
  maxConversations?: number;
  /** Mensajes por conversacion (Zernio permite hasta 100 por pagina). */
  messagesPerConversation?: number;
  /**
   * Presupuesto de tiempo. El plan Hobby de Vercel corta las funciones a los 300s con
   * un 504, asi que se corta antes por las buenas y se informa que quedo pendiente:
   * mejor una importacion parcial y reanudable que una muerta a mitad de camino.
   */
  timeBudgetMs?: number;
}

export interface BackfillResult {
  ok: boolean;
  conversations: number;
  messages: number;
  skipped: number;
  /** true si quedaron hilos sin importar: volver a correr para continuar. */
  incomplete: boolean;
  errors: string[];
}

export async function backfillFromZernio(
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const {
    channel,
    maxConversations = 200,
    messagesPerConversation = 100,
    timeBudgetMs = 240_000,
  } = options;

  // Los mensajes posteriores al arranque los trae el webhook en vivo. Ignorarlos evita
  // insertarlos dos veces: el REST no expone `platformMessageId`, asi que la misma
  // fila entraria con dos external_id distintos y el indice unico no la frenaria.
  const startedAt = Date.now();

  const result: BackfillResult = {
    ok: true,
    conversations: 0,
    messages: 0,
    skipped: 0,
    incomplete: false,
    errors: [],
  };

  if (!hasZernioKey()) {
    return {
      ...result,
      ok: false,
      errors: ["ZERNIO_API_KEY no configurada"],
    };
  }

  for await (const page of iterateConversations(
    { platform: channel },
    20,
    (message) => result.errors.push(message)
  )) {
    for (const conv of page) {
      const outOfTime = Date.now() - startedAt > timeBudgetMs;
      if (outOfTime || result.conversations >= maxConversations) {
        // La ingesta es idempotente (external_id unico), asi que volver a correr
        // continua sin duplicar nada.
        result.incomplete = true;
        result.errors.push(
          outOfTime
            ? "Se acabo el tiempo de la funcion: volve a importar para continuar."
            : `Tope de ${maxConversations} conversaciones alcanzado: volve a importar para continuar.`
        );
        return result;
      }

      try {
        const imported = await importConversation(
          conv,
          messagesPerConversation,
          startedAt
        );
        if (imported === null) {
          result.skipped++;
        } else {
          result.conversations++;
          result.messages += imported;
        }
      } catch (err) {
        result.errors.push(
          `${conv.id}: ${err instanceof Error ? err.message : "error desconocido"}`
        );
      }
    }
  }

  result.ok = result.errors.length === 0;
  return result;
}

/** @returns cantidad de mensajes importados, o null si la conversacion se salteo. */
async function importConversation(
  conv: ZernioConversation,
  limit: number,
  startedAt: number
): Promise<number | null> {
  if (!isChannel(conv.platform)) return null;
  const channel = conv.platform;

  const account = await getAccountByZernioId(conv.accountId);
  if (!account) return null;

  const participantId = conv.participantId
    ? channel === "whatsapp"
      ? `+${normalizePhone(conv.participantId)}`
      : conv.participantId
    : null;
  if (!participantId) return null;

  const contactId = await findOrCreateContactByIdentity({
    tenantId: account.tenantId,
    channel,
    externalId: participantId,
    name: conv.participantName ?? null,
    handle: null,
  });

  const conversation = await upsertConversation({
    tenantId: account.tenantId,
    contactId,
    accountId: account.id,
    channel,
    provider: "zernio",
    externalId: conv.id,
    participantId,
    participantName: conv.participantName ?? null,
    participantHandle: null,
    participantPicture: conv.participantPicture ?? null,
    metadata: conv.metadata,
  });

  const messages = await listMessages(conv.id, {
    accountId: conv.accountId,
    limit,
    sortOrder: "asc",
  });
  if (!messages.success) {
    throw new Error(messages.error.message);
  }

  const items = messages.data.messages ?? messages.data.data ?? [];
  let imported = 0;

  for (const msg of items) {
    if (msg.isDeleted) continue;

    const sentAt = parseDate(msg.sentAt ?? msg.createdAt);
    if (sentAt && sentAt.getTime() >= startedAt) continue;

    const res = await ingestMessage({
      conversation,
      direction: msg.direction === "outgoing" ? "out" : "in",
      externalId: msg.id ?? null,
      body: extractBody(msg),
      type: msg.message?.trim() ? "text" : (msg.attachments?.[0]?.type ?? "text"),
      sentAt,
      status: statusOf(msg),
      rawPayload: msg,
      // Lo importante de todo el archivo.
      enqueueAgent: false,
    });

    if (!res.duplicate) imported++;
  }

  return imported;
}

function statusOf(msg: ZernioInboxMessage): string | undefined {
  if (msg.direction === "outgoing") return msg.deliveryStatus ?? "sent";
  // Entrantes historicos entran como leidos: no tiene sentido que el inbox muestre
  // cientos de no leidos la primera vez que se conecta la cuenta.
  return "read";
}

function extractBody(msg: ZernioInboxMessage): string {
  const text = msg.message?.trim();
  if (text) return text;

  const attachment = msg.attachments?.[0];
  if (!attachment) return "[mensaje]";

  const kind = (attachment.type ?? "adjunto").toLowerCase();
  const label =
    kind === "image"
      ? "imagen"
      : kind === "video"
        ? "video"
        : kind === "audio"
          ? "audio"
          : kind === "file"
            ? "documento"
            : kind;
  const extra =
    msg.attachments && msg.attachments.length > 1
      ? ` (+${msg.attachments.length - 1})`
      : "";
  return `[${label}]${extra}`;
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
