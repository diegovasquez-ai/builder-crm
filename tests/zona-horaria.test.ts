import { describe, it, expect, vi, afterEach } from "vitest";
import { getConfig } from "@/lib/config";
import { renderSystemPrompt } from "@/lib/agent/prompt";
import { formatRelativeDate } from "@/lib/constants";

/**
 * El contenedor corre en UTC (una imagen compartida por muchas instancias no puede traer
 * la zona horneada), asi que la fecha que el agente recibe en su prompt tiene que
 * resolverse en la zona del negocio. Si no, de noche le dice "manana" al cliente: desde
 * las 21:00 en Chile el proceso ya esta en el dia siguiente. No hay excepcion ni log; el
 * sintoma es un agente que se equivoco de dia. Ver specs/nucleo/11-zona-horaria.md.
 */

const dia = (zona: string, instante: Date) =>
  new Intl.DateTimeFormat("es", { timeZone: zona, day: "numeric", month: "long" }).format(instante);

afterEach(() => {
  vi.useRealTimers();
});

describe("zona horaria de la instancia", () => {
  it("el prompt nombra el dia de la zona del negocio, no la del proceso", () => {
    // 02:00 UTC: en cualquier zona de America todavia es el dia anterior.
    const instante = new Date("2026-10-08T02:00:00.000Z");
    const local = dia(getConfig().zonaHoraria, instante);

    const prompt = renderSystemPrompt("La fecha de hoy es {{fecha}}.", { now: instante });

    expect(prompt).toContain(local);
    if (local !== dia("UTC", instante)) {
      expect(prompt).not.toContain(dia("UTC", instante));
    }
  });

  it("'Hoy' y 'Ayer' cambian a la medianoche local, no a las 24 horas", () => {
    // Antes se restaban milisegundos y se dividia por 86.400.000: a las 00:30, algo de
    // las 23:00 salia como "Hoy". La expectativa se calcula comparando el dia local, asi
    // que el caso sigue siendo correcto con cualquier zona configurada.
    const ahora = new Date("2026-10-08T12:00:00.000Z");
    const hace20h = new Date("2026-10-07T16:00:00.000Z");
    const diaLocal = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: getConfig().zonaHoraria, dateStyle: "short" })
        .format(d);

    vi.useFakeTimers();
    vi.setSystemTime(ahora);
    expect(formatRelativeDate(hace20h)).toBe(
      diaLocal(hace20h) === diaLocal(ahora) ? "Hoy" : "Ayer"
    );
  });

  it("la zona configurada es valida en este entorno", () => {
    // El esquema ya lo valida; esto cubre el caso de una instancia que declara una zona
    // que su propio Node no conoce (imagen vieja, ICU recortado).
    expect(() =>
      new Intl.DateTimeFormat("es", { timeZone: getConfig().zonaHoraria })
    ).not.toThrow();
  });
});
