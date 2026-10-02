import "server-only";
import { emitAutomationEvent } from "@/lib/automations";
import type { ContactCreatedPayload } from "@/lib/automations/triggers";

/**
 * Emite `contact.created`. Se llama desde cada lugar que da de alta un contacto real
 * (formulario, webhook de leads, importacion, y la ingesta de mensajes cuando alguien
 * nuevo escribe). Nunca lanza: un fallo aca no debe romper el alta.
 */
export async function emitContactCreated(
  contactId: string,
  info: { name: string; source: string; channel?: string | null }
): Promise<void> {
  const payload: ContactCreatedPayload = {
    contactName: info.name,
    source: info.source,
    channel: info.channel ?? null,
  };
  try {
    await emitAutomationEvent({
      trigger: "contact.created",
      contactId,
      payload: payload as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error("[automations] contact.created fallo", err);
  }
}
