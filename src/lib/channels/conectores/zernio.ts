import "server-only";
import { verifyZernioSignature, hasZernioWebhookSecret } from "@/lib/zernio/webhooks";
import { capabilitiesFor, isOutsideFreeFormWindow, type Channel } from "../types";
import type { Conector, EstadoConector } from "../conector";

/**
 * Conector Zernio: WhatsApp, Instagram DM y Facebook Messenger por una sola API y un
 * solo webhook. Es el camino normal del CRM.
 *
 * Este modulo importa solo lo liviano (firma HMAC, capacidades): lo usa la ruta del
 * webhook, que tiene 5 segundos para responder. El envio y la ingesta se importan
 * dinamicamente cuando hacen falta.
 */
export const zernio: Conector = {
  id: "zernio",
  nombre: "Zernio",
  canales: ["whatsapp", "instagram", "facebook"],

  async enviar(ctx, msg) {
    const text = msg.text?.trim();
    if (!text && !msg.template) {
      return { success: false, error: { message: "Mensaje vacio" } };
    }

    const accountId = ctx.account?.zernioAccountId;
    if (!accountId) {
      return {
        success: false,
        error: { message: "La conversacion no tiene cuenta de Zernio asociada" },
        hint: "Sincroniza las cuentas en Ajustes > Canales.",
      };
    }

    const { sendMessage, extractMessageId } = await import("@/lib/zernio/inbox");

    // La etiqueta la decide el servidor, no el cliente: es politica de Meta y el front
    // no es confiable para cumplirla. Fuera de las 24h, IG y Messenger solo aceptan
    // HUMAN_AGENT (valida 7 dias); en WhatsApp la unica salida es una plantilla.
    const caps = capabilitiesFor(ctx.channel);
    const needsTag =
      caps.humanAgentTag &&
      isOutsideFreeFormWindow(ctx.channel, ctx.conversation.lastInboundAt);

    const result = await sendMessage(ctx.conversation.externalId, {
      accountId,
      ...(msg.template
        ? {
            template: {
              name: msg.template.name,
              language: msg.template.language ?? "es",
              components: msg.template.components ?? [],
            },
          }
        : { message: text }),
      ...(needsTag
        ? { messageTag: "HUMAN_AGENT" as const, messagingType: "MESSAGE_TAG" as const }
        : {}),
    });

    if (!result.success) {
      return {
        success: false,
        error: { message: result.error.message, code: result.error.code },
        hint: hintForZernioError(result.error.status, ctx.channel, result.error.code),
      };
    }

    return { success: true, externalId: extractMessageId(result.data) };
  },

  webhook: {
    verificar(rawBody, headers) {
      return verifyZernioSignature(rawBody, headers.get("x-zernio-signature"));
    },
    idEvento(_rawBody, headers, payload) {
      const id = (payload as { id?: unknown } | null)?.id;
      return headers.get("x-zernio-event-id") ?? (typeof id === "string" ? id : null);
    },
    async procesar(payload) {
      const { processZernioEvent } = await import("../zernio-events");
      return processZernioEvent(payload as Parameters<typeof processZernioEvent>[0]);
    },
  },

  async estado(): Promise<EstadoConector> {
    const faltan: string[] = [];
    if (!process.env.ZERNIO_API_KEY) faltan.push("ZERNIO_API_KEY");
    if (!hasZernioWebhookSecret()) faltan.push("ZERNIO_WEBHOOK_SECRET");

    const notas: string[] = [];
    if (!hasZernioWebhookSecret()) {
      notas.push("Sin ZERNIO_WEBHOOK_SECRET el webhook rechaza todo (fail-closed): no entran mensajes.");
    }
    if (!process.env.ZERNIO_PROFILE_ID) {
      notas.push("Sin ZERNIO_PROFILE_ID se usa el perfil Default de la cuenta de Zernio.");
    }

    let cuentas: EstadoConector["cuentas"] = [];
    if (process.env.ZERNIO_API_KEY) {
      try {
        const { listChannelAccounts } = await import("../sync");
        cuentas = (await listChannelAccounts())
          .filter((a) => a.provider === "zernio")
          .map((a) => ({
            id: a.id,
            canal: a.platform,
            nombre: a.username ?? a.displayName ?? a.zernioAccountId ?? a.id,
            estado: a.status,
          }));
      } catch {
        notas.push("No se pudieron listar las cuentas conectadas.");
      }
    }

    return { id: "zernio", nombre: "Zernio", configurado: faltan.length === 0, faltan, cuentas, notas };
  },
};

function hintForZernioError(status: number, channel: Channel, code?: string): string | undefined {
  if (code === "TEMPLATE_REQUIRED") {
    return "WhatsApp no permite texto libre fuera de la ventana de 24h: hay que mandar una plantilla aprobada.";
  }
  if (status === 401 || status === 403) {
    return "Zernio rechazo las credenciales. Revisa ZERNIO_API_KEY y que la cuenta siga conectada.";
  }
  if (status === 429) {
    return "Zernio o Meta estan limitando el envio. Reintenta en unos minutos.";
  }
  if (status === 400 && channel !== "whatsapp") {
    return "Meta puede haber rechazado el mensaje por estar fuera de la ventana de 24h.";
  }
  return undefined;
}
