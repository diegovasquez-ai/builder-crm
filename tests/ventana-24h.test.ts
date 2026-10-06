import { describe, it, expect } from "vitest";
import { capabilitiesFor, isOutsideFreeFormWindow } from "@/lib/channels/types";

/**
 * La ventana de texto libre la decide el servidor, no el canal. Si este calculo se
 * equivoca hacia adentro (cree que esta abierta cuando se cerro), Meta descarta el
 * mensaje y el CRM lo muestra como enviado: el lead queda esperando una respuesta que
 * nunca le llego y nadie se entera hasta que el cliente reclama.
 */

const AHORA = new Date("2026-10-06T12:00:00.000Z");
const horasAntes = (h: number) => new Date(AHORA.getTime() - h * 60 * 60 * 1000);

describe("ventana de texto libre por canal", () => {
  it("whatsapp e instagram declaran 24 horas", () => {
    expect(capabilitiesFor("whatsapp").freeFormWindowHours).toBe(24);
    expect(capabilitiesFor("instagram").freeFormWindowHours).toBe(24);
  });

  it("dentro de la ventana permite texto libre", () => {
    expect(isOutsideFreeFormWindow("whatsapp", horasAntes(23), AHORA)).toBe(false);
    expect(isOutsideFreeFormWindow("whatsapp", horasAntes(0.5), AHORA)).toBe(false);
  });

  it("pasada la ventana la cierra", () => {
    expect(isOutsideFreeFormWindow("whatsapp", horasAntes(25), AHORA)).toBe(true);
  });

  it("en el limite exacto todavia esta abierta", () => {
    // Justo a las 24 h no se cierra: cerrar un segundo antes manda una plantilla sin
    // necesidad, y eso le cuesta plata al cliente en cada conversacion.
    expect(isOutsideFreeFormWindow("whatsapp", horasAntes(24), AHORA)).toBe(false);
  });

  it("sin mensaje entrante previo la considera cerrada", () => {
    // Fail-closed: una conversacion que arranca el negocio nunca tiene ventana abierta.
    expect(isOutsideFreeFormWindow("whatsapp", null, AHORA)).toBe(true);
    expect(isOutsideFreeFormWindow("whatsapp", undefined, AHORA)).toBe(true);
  });

  it("con una fecha invalida la considera cerrada en vez de romperse", () => {
    expect(isOutsideFreeFormWindow("whatsapp", "no-es-una-fecha", AHORA)).toBe(true);
  });

  it("acepta la fecha como texto, que es como vuelve de la base", () => {
    expect(isOutsideFreeFormWindow("whatsapp", horasAntes(2).toISOString(), AHORA)).toBe(false);
    expect(isOutsideFreeFormWindow("whatsapp", horasAntes(48).toISOString(), AHORA)).toBe(true);
  });
});
