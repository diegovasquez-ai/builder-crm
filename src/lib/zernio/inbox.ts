import { zernioFetch, getProfileId } from "./client";
import type {
  ZernioAttachment,
  ZernioConversation,
  ZernioInboxMessage,
  ZernioListResponse,
  ZernioPlatform,
  ZernioResult,
} from "./types";

/** Bandeja unificada de Zernio: conversaciones y mensajes de todas las plataformas. */

export interface ListConversationsParams {
  platform?: ZernioPlatform;
  accountId?: string;
  status?: "active" | "archived";
  sortOrder?: "asc" | "desc";
  /** 1-100, default 50 del lado de Zernio. */
  limit?: number;
  cursor?: string;
  profileId?: string;
}

export async function listConversations(
  params: ListConversationsParams = {}
): Promise<ZernioResult<ZernioListResponse<ZernioConversation>>> {
  return zernioFetch<ZernioListResponse<ZernioConversation>>(
    "/inbox/conversations",
    {
      query: {
        profileId: params.profileId ?? getProfileId() ?? undefined,
        platform: params.platform,
        accountId: params.accountId,
        status: params.status,
        sortOrder: params.sortOrder,
        limit: params.limit,
        cursor: params.cursor,
      },
    }
  );
}

/**
 * Pagina todas las conversaciones siguiendo `nextCursor`. `maxPages` es un tope duro:
 * sin el, un cursor que no avanza (bug del proveedor) haria un loop infinito.
 */
export async function* iterateConversations(
  params: ListConversationsParams = {},
  maxPages = 20,
  onError?: (message: string) => void
): AsyncGenerator<ZernioConversation[], void, void> {
  let cursor = params.cursor;

  for (let page = 0; page < maxPages; page++) {
    const result = await listConversations({ ...params, cursor });
    if (!result.success) {
      // Sin este callback el llamador no distingue "no hay conversaciones" de
      // "la API fallo", y una importacion rota se lee como exitosa.
      console.error("[zernio] listConversations fallo:", result.error.message);
      onError?.(result.error.message);
      return;
    }

    const { data, pagination, meta } = result.data;
    if (meta?.failedAccounts?.length) {
      // No es un error de la request: Zernio degrada por cuenta. Si no se loguea, una
      // sincronizacion parcial se lee como completa.
      console.warn(
        "[zernio] cuentas que fallaron en la consulta:",
        meta.failedAccounts.map((a) => `${a.accountUsername ?? a.accountId}: ${a.error}`)
      );
    }

    if (data.length > 0) yield data;

    if (!pagination?.hasMore || !pagination.nextCursor) return;
    if (pagination.nextCursor === cursor) {
      console.warn("[zernio] nextCursor no avanza, corto la paginacion");
      return;
    }
    cursor = pagination.nextCursor;
  }

  console.warn(`[zernio] tope de ${maxPages} paginas alcanzado`);
}

export interface ListMessagesParams {
  accountId?: string;
  /** 1-100, default 100. */
  limit?: number;
  cursor?: string;
  sortOrder?: "asc" | "desc";
}

/** La respuesta trae los mensajes en `messages`, no en `data`. */
export interface ListMessagesResponse {
  messages?: ZernioInboxMessage[];
  data?: ZernioInboxMessage[];
  pagination?: { hasMore: boolean; nextCursor?: string | null };
  lastUpdated?: string;
}

export async function listMessages(
  conversationId: string,
  params: ListMessagesParams = {}
): Promise<ZernioResult<ListMessagesResponse>> {
  return zernioFetch<ListMessagesResponse>(
    `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      query: {
        accountId: params.accountId,
        limit: params.limit,
        cursor: params.cursor,
        sortOrder: params.sortOrder,
      },
    }
  );
}

/** Referencia a una plantilla aprobada, tal como la espera el endpoint de envio. */
export interface ZernioTemplateRef {
  name: string;
  language: string;
  components?: unknown[];
}

export interface SendMessageInput {
  accountId: string;
  message?: string;
  /**
   * Fuera de la ventana de 24h, Instagram y Messenger solo aceptan HUMAN_AGENT
   * (valida 7 dias) y hay que acompanarlo de messagingType MESSAGE_TAG.
   */
  messageTag?: "HUMAN_AGENT";
  messagingType?: "RESPONSE" | "MESSAGE_TAG";
  attachments?: ZernioAttachment[];
  /** WhatsApp: plantilla aprobada dentro de un hilo que ya existe. */
  template?: ZernioTemplateRef;
  /**
   * WhatsApp Direct Send: mensaje de utilidad iniciado por el negocio SIN plantilla
   * aprobada. Requiere que la WABA sea elegible; si no lo es, Meta rechaza el envio.
   */
  category?: "utility";
  /** Zernio replica la respuesta original en lugar de reenviar. Valido 24h. */
  idempotencyKey?: string;
}

export interface SendMessageResponse {
  /**
   * Zernio envuelve la respuesta: `{ success, data: { messageId, conversationId } }`.
   * El cliente devuelve el cuerpo crudo, asi que el id util vive UN NIVEL ADENTRO.
   */
  data?: {
    messageId?: string;
    conversationId?: string;
    /**
     * Facebook e Instagram cuando se manda adjunto + texto: Meta lo parte en dos
     * mensajes. El primero es el adjunto y coincide con `messageId`.
     */
    messageIds?: string[];
    [key: string]: unknown;
  };
  id?: string;
  messageId?: string;
  conversationId?: string;
  [key: string]: unknown;
}

export async function sendMessage(
  conversationId: string,
  input: SendMessageInput
): Promise<ZernioResult<SendMessageResponse>> {
  return zernioFetch<SendMessageResponse>(
    `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: input.idempotencyKey
        ? { "Idempotency-Key": input.idempotencyKey }
        : undefined,
      body: {
        accountId: input.accountId,
        ...(input.message ? { message: input.message } : {}),
        ...(input.messageTag ? { messageTag: input.messageTag } : {}),
        ...(input.messagingType ? { messagingType: input.messagingType } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
        ...(input.category ? { category: input.category } : {}),
        // El endpoint espera la plantilla envuelta en `elements`, con un solo elemento.
        ...(input.template
          ? { template: { elements: [input.template] } }
          : {}),
      },
    }
  );
}

export interface CreateConversationInput {
  accountId: string;
  /** WhatsApp: telefono en formato internacional, SIN el `+`. */
  participantId?: string;
  participantUsername?: string;
  message?: string;
  templateName?: string;
  templateLanguage?: string;
  /**
   * Valores de las variables en UN solo array plano y en el orden en que aparecen en
   * la plantilla: primero las del header de texto, despues las del body, y al final
   * una por cada boton de URL dinamica.
   */
  templateParams?: string[];
  category?: "utility";
  idempotencyKey?: string;
}

export interface CreateConversationResponse {
  conversationId?: string;
  id?: string;
  messageId?: string;
  [key: string]: unknown;
}

/**
 * Inicia una conversacion de WhatsApp con un numero con el que no hay hilo abierto.
 *
 * Es TAMBIEN la unica forma de reenganchar a alguien pasadas las 24 horas: WhatsApp no
 * permite texto libre para abrir conversacion, asi que sin `templateName` la API
 * devuelve TEMPLATE_REQUIRED (salvo Direct Send con `category: 'utility'`).
 * Si ya existe un hilo con ese numero, la plantilla entra en ese mismo hilo.
 */
export async function createConversation(
  input: CreateConversationInput
): Promise<ZernioResult<CreateConversationResponse>> {
  return zernioFetch<CreateConversationResponse>("/inbox/conversations", {
    method: "POST",
    headers: input.idempotencyKey
      ? { "Idempotency-Key": input.idempotencyKey }
      : undefined,
    body: {
      accountId: input.accountId,
      ...(input.participantId ? { participantId: input.participantId } : {}),
      ...(input.participantUsername
        ? { participantUsername: input.participantUsername }
        : {}),
      ...(input.message ? { message: input.message } : {}),
      ...(input.templateName ? { templateName: input.templateName } : {}),
      ...(input.templateLanguage
        ? { templateLanguage: input.templateLanguage }
        : {}),
      ...(input.templateParams?.length
        ? { templateParams: input.templateParams }
        : {}),
      ...(input.category ? { category: input.category } : {}),
    },
  });
}

/** Zernio devuelve el id del mensaje con distinto nombre segun endpoint. */
/**
 * Id del mensaje recien enviado.
 *
 * IMPORTA MAS DE LO QUE PARECE: es la clave con la que se deduplica el eco. Zernio
 * manda un webhook `message.sent` por cada mensaje que sale, incluidos los que mando
 * el propio CRM. Si la fila saliente se guarda sin este id, el indice unico (que es
 * parcial, `where external_id is not null`) no puede frenar nada y el mensaje aparece
 * DOS VECES en la bandeja, aunque al cliente le llegue una sola.
 *
 * Se leen las dos formas —con y sin envoltorio— para no depender de que la API no
 * cambie de opinion.
 */
export function extractMessageId(res: SendMessageResponse): string | null {
  return (
    res.data?.messageId ??
    res.data?.messageIds?.[0] ??
    res.messageId ??
    res.id ??
    null
  );
}
