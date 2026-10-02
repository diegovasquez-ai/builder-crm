import "server-only";
import type { Conector, EstadoConector } from "../conector";

/**
 * Conector del simulador: para probar el agente y hacer demos sin ningun canal
 * conectado. La conversacion simulada (`provider = "simulador"`) entra a la bandeja
 * como cualquier otra y el agente la atiende por el mismo camino; la diferencia es que
 * `enviar` no sale a la red: `deliverMessage` persiste el saliente y listo.
 *
 * No recibe webhooks: los mensajes "entrantes" los crea /api/simulador/mensajes.
 */
export const simulador: Conector = {
  id: "simulador",
  nombre: "Simulador",
  canales: ["whatsapp", "instagram", "facebook"],

  async enviar(_ctx, msg) {
    const text = msg.text?.trim();
    if (!text && !msg.template) {
      return { success: false, error: { message: "Mensaje vacio" } };
    }
    return { success: true, externalId: `sim:out:${crypto.randomUUID()}` };
  },

  async estado(): Promise<EstadoConector> {
    return {
      id: "simulador",
      nombre: "Simulador",
      configurado: true,
      faltan: [],
      cuentas: [],
      notas: [
        "Para demos y autoverificacion: las conversaciones simuladas no salen a ningun canal real.",
        process.env.OPENROUTER_API_KEY
          ? "Agente listo para responder."
          : "Falta OPENROUTER_API_KEY: el simulador no puede hacer responder al agente.",
      ],
    };
  },
};
