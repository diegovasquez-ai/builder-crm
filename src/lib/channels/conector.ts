import type { conversations } from "@/db/schema";
import type { ChannelAccount } from "./accounts";
import type { Channel, Provider } from "./types";

/**
 * Interfaz comun de los conectores de canal.
 *
 * Un conector es POR DONDE viaja un mensaje (Zernio, Meta Cloud API, el simulador...).
 * El canal (WhatsApp, Instagram, Messenger) es QUE red ve el usuario; un conector puede
 * servir varios. La bandeja y el agente solo conocen esta interfaz:
 *
 *   enviar   -> lo llama `deliverMessage`, el unico camino de salida.
 *   webhook  -> lo usa `src/lib/channels/webhook.ts` para verificar, deduplicar y
 *               procesar lo que entra (la ruta /api/webhooks/<id> es de 5 lineas).
 *   estado   -> lo muestra Ajustes -> Canales.
 *
 * Para agregar un conector (por ejemplo la API oficial de WhatsApp como Tech Provider):
 * ver src/lib/channels/conectores/README.md.
 */

export type ConversationRow = typeof conversations.$inferSelect;

export interface OutboundTemplate {
  name: string;
  language?: string;
  components?: unknown[];
  previewText?: string;
}

export interface OutboundMessage {
  text?: string;
  template?: OutboundTemplate;
}

export interface SendOutcome {
  success: boolean;
  externalId?: string | null;
  error?: { message?: string; code?: string | number };
  /** Mensaje legible para mostrar en la UI cuando el envio falla. */
  hint?: string;
}

export interface DeliveryContext {
  conversation: ConversationRow;
  account: ChannelAccount | null;
  channel: Channel;
}

/** Resultado de procesar un evento entrante. `retry` = llego fuera de orden, reintentar. */
export interface ResultadoWebhook {
  status: "processed" | "ignored" | "retry";
  reason?: string;
  /** Jobs del agente encolados por la ingesta: el webhook los dispara al worker. */
  jobIds: string[];
}

export interface WebhookConector {
  /** Firma del proveedor sobre el cuerpo crudo. Fail-closed si falta el secreto. */
  verificar(rawBody: string, headers: Headers): boolean;
  /**
   * Id unico del evento para deduplicar entre reintentos (header o campo del payload).
   * null = el nucleo usa el hash del cuerpo.
   */
  idEvento(rawBody: string, headers: Headers, payload: unknown): string | null;
  /**
   * Normaliza el payload y persiste con las funciones de `ingest.ts`. Corre dentro de
   * `after()`: lo pesado (ingesta, agente) debe importarse dinamicamente aqui adentro
   * para no engordar el cold start de la ruta.
   */
  procesar(payload: unknown): Promise<ResultadoWebhook>;
}

export interface CuentaConectada {
  id: string;
  canal: Channel;
  nombre: string;
  estado: string;
}

export interface EstadoConector {
  id: Provider;
  nombre: string;
  /** true si tiene lo minimo para operar (credenciales por entorno). */
  configurado: boolean;
  /** Variables de entorno que faltan. */
  faltan: string[];
  cuentas: CuentaConectada[];
  /** Avisos para el administrador (modo, limitaciones, pasos pendientes). */
  notas: string[];
}

export interface Conector {
  /** Coincide con `conversations.provider` y `messages.provider`. */
  id: Provider;
  nombre: string;
  canales: readonly Channel[];
  enviar(ctx: DeliveryContext, msg: OutboundMessage): Promise<SendOutcome>;
  /** Sin `webhook`, el conector solo envia (o su ingesta vive en una ruta legacy). */
  webhook?: WebhookConector;
  estado(): Promise<EstadoConector>;
}
