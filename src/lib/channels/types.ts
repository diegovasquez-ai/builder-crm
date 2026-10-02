/**
 * Canal y proveedor son dos ejes distintos, y confundirlos es lo que haria imposible el
 * cutover de WhatsApp con rollback:
 *
 *   channel  -> QUE red es (lo ve el usuario: badge, filtro, prompt del agente, plantillas)
 *   provider -> POR DONDE viaja (lo ve el sistema: que adapter envia, que webhook alimenta)
 *
 * Durante la migracion va a existir `channel='whatsapp'` con `provider='meta'` y con
 * `provider='zernio'` al mismo tiempo, conviviendo en la misma bandeja.
 */

export const CHANNELS = ["whatsapp", "instagram", "facebook"] as const;
export type Channel = (typeof CHANNELS)[number];

export const PROVIDERS = ["zernio", "meta", "simulador"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Messenger",
};

export function isChannel(value: unknown): value is Channel {
  return (
    typeof value === "string" && (CHANNELS as readonly string[]).includes(value)
  );
}

export function isProvider(value: unknown): value is Provider {
  return (
    typeof value === "string" &&
    (PROVIDERS as readonly string[]).includes(value)
  );
}

/** Lo que cada canal permite hacer. Lo consume la UI y el adapter de salida. */
export interface ChannelCapabilities {
  /** Plantillas aprobadas por Meta. Solo WhatsApp las tiene. */
  templates: boolean;
  /** Horas de ventana de texto libre desde el ultimo mensaje entrante. */
  freeFormWindowHours: number;
  /**
   * Fuera de la ventana, IG y Messenger permiten seguir respondiendo con la etiqueta
   * HUMAN_AGENT (valida 7 dias). WhatsApp no: ahi el unico camino es una plantilla.
   */
  humanAgentTag: boolean;
  attachments: boolean;
}

const CAPABILITIES: Record<Channel, ChannelCapabilities> = {
  whatsapp: {
    templates: true,
    freeFormWindowHours: 24,
    humanAgentTag: false,
    attachments: true,
  },
  instagram: {
    templates: false,
    freeFormWindowHours: 24,
    humanAgentTag: true,
    attachments: true,
  },
  facebook: {
    templates: false,
    freeFormWindowHours: 24,
    humanAgentTag: true,
    attachments: true,
  },
};

export function capabilitiesFor(channel: Channel): ChannelCapabilities {
  return CAPABILITIES[channel];
}

/** true si ya pasaron mas horas que la ventana de texto libre del canal. */
export function isOutsideFreeFormWindow(
  channel: Channel,
  lastInboundAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!lastInboundAt) return true;
  const last = new Date(lastInboundAt).getTime();
  if (Number.isNaN(last)) return true;
  const windowMs = capabilitiesFor(channel).freeFormWindowHours * 60 * 60 * 1000;
  return now.getTime() - last > windowMs;
}
