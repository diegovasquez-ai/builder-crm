import "server-only";
import type { Conector, EstadoConector } from "../conector";

/**
 * Conector Meta Cloud API (WhatsApp directo, sin Zernio). PARCIAL a proposito.
 *
 * Que hay:
 *  - `enviar`: texto y plantillas por Graph API (src/lib/meta-whatsapp.ts), con las
 *    credenciales de `whatsapp_accounts` o del entorno (WHATSAPP_*).
 *  - `estado`: que falta para operar.
 *
 * Que NO hay todavia (y es lo que implementa el futuro conector "Cloud API / Tech
 * Provider", ver ../README.md):
 *  - `webhook`: la ingesta sigue en la ruta legacy /api/webhooks/whatsapp, que solo
 *    procesa mensajes con WHATSAPP_PROVIDER=meta. Al implementarla aqui, esa ruta
 *    pasa a ser `manejarWebhook(metaCloud, req)` y se borra su logica propia.
 *  - Conexion desde la UI (Embedded Signup). Hoy: scripts/connect-whatsapp-account.ts.
 *
 * Se activa como transporte de WhatsApp con WHATSAPP_PROVIDER=meta (valvula de escape).
 */
export const metaCloud: Conector = {
  id: "meta",
  nombre: "Meta Cloud API (WhatsApp directo)",
  canales: ["whatsapp"],

  async enviar(ctx, msg) {
    const to = ctx.conversation.participantId;
    if (!to) {
      return { success: false, error: { message: "La conversacion no tiene telefono de destino" } };
    }

    const [{ sendTextMessage, sendTemplateMessage }, { getAccountByTenant }] = await Promise.all([
      import("@/lib/meta-whatsapp"),
      import("@/lib/whatsapp-accounts"),
    ]);

    const account = await getAccountByTenant(ctx.conversation.tenantId);

    const result = msg.template
      ? await sendTemplateMessage(
          account,
          to,
          msg.template.name,
          msg.template.language ?? "es",
          msg.template.components ?? []
        )
      : await sendTextMessage(account, to, msg.text ?? "");

    if (!result.success) {
      return {
        success: false,
        error: { message: result.error?.message, code: result.error?.code },
        hint: hintForMetaError(result.error?.code),
      };
    }

    return { success: true, externalId: result.messageId ?? null };
  },

  // webhook: pendiente (ver cabecera). La ruta legacy /api/webhooks/whatsapp sigue activa.

  async estado(): Promise<EstadoConector> {
    const activo = (process.env.WHATSAPP_PROVIDER || "zernio").toLowerCase() === "meta";
    const faltan: string[] = [];
    let cuentas: EstadoConector["cuentas"] = [];

    try {
      const { getPrimaryAccount } = await import("@/lib/whatsapp-accounts");
      const cuenta = await getPrimaryAccount();
      if (cuenta) {
        cuentas = [
          {
            id: cuenta.id,
            canal: "whatsapp",
            nombre: cuenta.displayPhone ?? cuenta.phoneNumberId,
            estado: cuenta.accessToken ? "active" : "sin token",
          },
        ];
      }
    } catch {
      /* sin base o sin tabla: se evalua solo por entorno */
    }

    if (cuentas.length === 0) {
      if (!process.env.WHATSAPP_ACCESS_TOKEN) faltan.push("WHATSAPP_ACCESS_TOKEN");
      if (!process.env.WHATSAPP_PHONE_NUMBER_ID) faltan.push("WHATSAPP_PHONE_NUMBER_ID");
    }
    if (!process.env.WHATSAPP_APP_SECRET) faltan.push("WHATSAPP_APP_SECRET");
    if (!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) faltan.push("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

    const notas = [
      activo
        ? "Activo como transporte de WhatsApp (WHATSAPP_PROVIDER=meta). La ingesta entra por /api/webhooks/whatsapp."
        : "Inactivo: WhatsApp va por Zernio. Para usarlo, WHATSAPP_PROVIDER=meta.",
      "Conector parcial: envio y estado. El conector Cloud API / Tech Provider completo esta documentado en src/lib/channels/conectores/README.md.",
    ];

    return {
      id: "meta",
      nombre: "Meta Cloud API (WhatsApp directo)",
      configurado: faltan.length === 0,
      faltan,
      cuentas,
      notas,
    };
  },
};

/** Codigos de Graph mas comunes, en lenguaje humano. */
function hintForMetaError(code: number | undefined): string | undefined {
  switch (code) {
    case 131030:
      return "El numero no esta en la lista de destinatarios permitidos de la app de Meta.";
    case 131047:
      return "Pasaron mas de 24h desde el ultimo mensaje del cliente: hay que usar una plantilla aprobada.";
    case 132000:
      return "La plantilla no coincide con la cantidad de variables esperadas.";
    case 190:
      return "El token de acceso de Meta expiro.";
    default:
      return undefined;
  }
}
