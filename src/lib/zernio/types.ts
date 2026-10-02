/**
 * Tipos de la API de Zernio (https://docs.zernio.com), escritos a mano contra la doc.
 * Solo se tipa lo que consumimos; el resto de la superficie llega como `unknown`.
 */

/** Zernio soporta 16 plataformas; el CRM usa estas tres mas las que puedan llegar. */
export type ZernioPlatform =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "twitter"
  | "bluesky"
  | "reddit"
  | "telegram"
  | (string & {});

export interface ZernioError {
  status: number;
  code?: string;
  message: string;
  /** Segundos a esperar si el status es 429. */
  retryAfter?: number;
  raw?: unknown;
}

export type ZernioResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZernioError };

export interface ZernioPagination {
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface ZernioFailedAccount {
  accountId: string;
  accountUsername?: string;
  platform?: string;
  error?: string;
  code?: string;
  retryAfter?: number;
}

/**
 * Zernio no falla la request entera si una cuenta no responde: la degrada aca. Hay que
 * mirarlo o una sincronizacion parcial se lee como completa.
 */
export interface ZernioListMeta {
  accountsQueried?: number;
  accountsFailed?: number;
  failedAccounts?: ZernioFailedAccount[];
  lastUpdated?: string;
}

export interface ZernioListResponse<T> {
  data: T[];
  pagination?: ZernioPagination;
  meta?: ZernioListMeta;
}

export interface ZernioInstagramProfile {
  isFollower?: boolean;
  isFollowing?: boolean;
  followerCount?: number;
  isVerified?: boolean;
  fetchedAt?: string;
}

/**
 * Atribucion de origen. `ctwa_*` = Click To WhatsApp Ads, `meta_ad_*` = anuncio de
 * Meta que genero el DM. Para una inmobiliaria esto es saber de que aviso vino el lead.
 */
export interface ZernioConversationMetadata {
  ctwa_clid?: string;
  ctwa_source_id?: string;
  ctwa_source_type?: string;
  ctwa_source_url?: string;
  ctwa_headline?: string;
  ctwa_captured_at?: string;
  meta_ad_id?: string;
  meta_ad_source?: string;
  meta_ad_type?: string;
  meta_ad_ref?: string;
  meta_ad_title?: string;
  meta_ad_photo_url?: string;
  meta_ad_video_url?: string;
  meta_ad_post_id?: string;
  meta_ad_product_id?: string;
  meta_ad_flow_id?: string;
  meta_ad_captured_at?: string;
}

export interface ZernioConversation {
  id: string;
  platform: ZernioPlatform;
  accountId: string;
  accountUsername?: string;
  /** IGSID en Instagram, PSID en Messenger, telefono en WhatsApp. */
  participantId?: string;
  participantName?: string;
  participantPicture?: string;
  participantVerifiedType?: string;
  lastMessage?: string;
  updatedTime?: string;
  status?: "active" | "archived" | (string & {});
  unreadCount?: number;
  url?: string;
  instagramProfile?: ZernioInstagramProfile;
  metadata?: ZernioConversationMetadata;
}

export interface ZernioAttachment {
  type?: string;
  url?: string;
  name?: string;
  mimeType?: string;
  [key: string]: unknown;
}

/** Direccion tal cual la manda Zernio; se normaliza a "in"/"out" al persistir. */
export type ZernioDirection = "incoming" | "outgoing";

export interface ZernioMessageSender {
  /**
   * Identificador del remitente en la plataforma. En WhatsApp es el telefono SIN el `+`
   * cuando esta disponible, y si no el `businessScopedUserId`.
   */
  id: string;
  /** Contacto del CRM de Zernio, si ya lo tiene mapeado. No lo usamos: el CRM es el nuestro. */
  contactId?: string;
  name?: string;
  username?: string;
  /**
   * Solo WhatsApp, E.164 con `+`. NULLABLE desde el rollout de BSUID (abril 2026): los
   * usuarios con username pueden escribir sin exponer el telefono. Para esos casos hay
   * que anclar la identidad en `businessScopedUserId`.
   */
  phone?: string | null;
  businessScopedUserId?: string;
}

export interface ZernioMessage {
  id: string;
  conversationId: string;
  platform: ZernioPlatform;
  /** Id del mensaje en la plataforma (wamid.* en WhatsApp). */
  platformMessageId?: string;
  direction: ZernioDirection;
  text?: string | null;
  attachments?: ZernioAttachment[];
  sender?: ZernioMessageSender;
  sentAt?: string;
  isRead?: boolean;
  deliveryStatus?: "sent" | "delivered" | "read" | "failed" | "deleted" | (string & {});
  deliveryError?: { code?: number; title?: string; message?: string } | null;
  metadata?: Record<string, unknown>;
}

/**
 * Mensaje tal como lo devuelve el REST (`GET /inbox/conversations/{id}/messages`).
 *
 * OJO: NO es la misma forma que la del webhook. El REST usa `message` / `senderId` /
 * `createdAt` y no expone `platformMessageId`; el webhook usa `text` / `sender.id` /
 * `sentAt` y si lo expone. Son dos contratos distintos para la misma entidad.
 */
export interface ZernioInboxMessage {
  id: string;
  conversationId?: string;
  accountId?: string;
  platform?: ZernioPlatform;
  message?: string | null;
  senderId?: string;
  senderName?: string | null;
  direction?: ZernioDirection;
  createdAt?: string;
  sentAt?: string | null;
  readAt?: string | null;
  deliveredAt?: string | null;
  deliveryStatus?: string | null;
  attachments?: ZernioAttachment[];
  isDeleted?: boolean;
}

export interface ZernioAccount {
  id: string;
  platform: ZernioPlatform;
  profileId?: string;
  username?: string;
  name?: string;
  displayName?: string;
  picture?: string;
  status?: string;
  connectedAt?: string;
}

export interface ZernioProfile {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
}

// ============================================================
// Webhooks
// ============================================================

export const ZERNIO_INBOX_EVENTS = [
  "message.received",
  "message.sent",
  "conversation.started",
  "message.edited",
  "message.deleted",
  "message.delivered",
  "message.read",
  "message.failed",
  "reaction.received",
  "comment.received",
  "review.new",
  "review.updated",
] as const;

export const ZERNIO_ACCOUNT_EVENTS = [
  "account.connected",
  "account.disconnected",
] as const;

export type ZernioEventName =
  | (typeof ZERNIO_INBOX_EVENTS)[number]
  | (typeof ZERNIO_ACCOUNT_EVENTS)[number]
  | (string & {});

/** La conversacion tal como viaja dentro de un webhook (no es la del endpoint de listado). */
export interface ZernioWebhookConversation {
  id: string;
  platformConversationId?: string;
  participantId?: string;
  participantName?: string;
  participantUsername?: string;
  participantPicture?: string;
  status?: "active" | "archived" | (string & {});
  contactId?: string;
  metadata?: ZernioConversationMetadata;
}

export interface ZernioWebhookAccount {
  id?: string;
  accountId?: string;
  profileId?: string;
  platform?: ZernioPlatform;
  username?: string;
  displayName?: string;
}

/**
 * Envelope de todo webhook de Zernio: `{ id, event, message, conversation, account,
 * timestamp }`. Los campos concretos varian por evento, asi que se leen defensivamente
 * y el payload entero se guarda en `webhook_events.payload` / `messages.raw_payload`.
 */
export interface ZernioWebhookPayload {
  id?: string;
  event: ZernioEventName;
  timestamp?: string;
  message?: ZernioMessage;
  conversation?: ZernioWebhookConversation;
  account?: ZernioWebhookAccount;
  [key: string]: unknown;
}

export interface ZernioWebhookSubscription {
  id: string;
  url: string;
  events: string[];
  status?: string;
}
