import crypto from "node:crypto";

// Igual que en client.ts: se lee al usarlo, no al importar el modulo.
function webhookSecret(): string {
  return process.env.ZERNIO_WEBHOOK_SECRET || "";
}

/**
 * Verifica la firma de un webhook de Zernio.
 *
 * Mismo patron que `verifyWebhookSignature` de meta-whatsapp.ts, con una diferencia:
 * Zernio manda el header `X-Zernio-Signature` como hex crudo en minuscula, SIN el
 * prefijo `sha256=` que usa Meta.
 *
 * Fail-closed: sin secreto configurado devuelve false. Un webhook publico sin firma
 * deja que cualquiera inyecte mensajes falsos en la bandeja.
 *
 * @param rawBody el cuerpo SIN parsear. Con `JSON.parse` + `stringify` la firma no valida.
 */
export function verifyZernioSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string = webhookSecret()
): boolean {
  if (!secret) {
    console.warn(
      "[zernio] ZERNIO_WEBHOOK_SECRET no configurado: se rechaza el webhook"
    );
    return false;
  }
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const provided = signatureHeader.trim().toLowerCase().replace(/^sha256=/, "");

  // timingSafeEqual lanza si los buffers difieren en longitud: comparar antes.
  if (expected.length !== provided.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex")
    );
  } catch {
    return false;
  }
}

export function hasZernioWebhookSecret(): boolean {
  return webhookSecret().length > 0;
}

/**
 * Eventos que el CRM necesita recibir.
 *
 * El alta se hace con `npm run zernio:webhook -- --url https://tu-app` (que pega a
 * `POST /v1/webhooks/settings`), no a mano en el dashboard. Si cambias esta lista,
 * volve a correr el script: la suscripcion vive del lado de Zernio y no se entera sola.
 *
 * Zernio apaga el webhook despues de 10 fallos de entrega seguidos, asi que un deploy
 * roto que devuelva 500 un rato deja la suscripcion inactiva y hay que reactivarla.
 */
export const SUBSCRIBED_EVENTS = [
  "conversation.started",
  "message.received",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.edited",
  "message.deleted",
  "account.connected",
  "account.disconnected",
] as const;
