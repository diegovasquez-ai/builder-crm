/**
 * Proveedor de WhatsApp. Por defecto **zernio**: WhatsApp, Instagram y Messenger van
 * todos por Zernio con una sola API y un solo webhook.
 *
 * `WHATSAPP_PROVIDER=meta` existe como valvula de escape: vuelve a la integracion
 * directa con Meta Cloud API (`/api/webhooks/whatsapp` + `meta-whatsapp.ts`), que se
 * conserva funcionando. Es un cambio de variable de entorno, sin migracion de datos.
 */
export type WhatsappProvider = "zernio" | "meta";

export function whatsappProvider(): WhatsappProvider {
  return (process.env.WHATSAPP_PROVIDER || "zernio").toLowerCase() === "meta"
    ? "meta"
    : "zernio";
}

/** true si el webhook de Meta todavia tiene que procesar mensajes de WhatsApp. */
export function metaWebhookActive(): boolean {
  return whatsappProvider() === "meta";
}
