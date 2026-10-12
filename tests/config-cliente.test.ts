import { describe, it, expect } from "vitest";
import { esquemaConfig } from "@/lib/config/schema";

/**
 * `config/cliente.ts` es lo unico que toca un miembro para adaptar el CRM. Este esquema
 * es el contrato de esa adaptacion: si deja pasar algo invalido, el error aparece mucho
 * mas tarde y en otro lado (un pipeline con dos etapas iguales, un color que rompe el
 * contraste, un campo de seleccion sin opciones), y lo descubre el cliente.
 */

const BASE = {
  marca: { nombre: "Clinica Norte", nombreCorto: "Norte" },
  pipeline: {
    etapas: [
      { clave: "consulta", nombre: "Consulta nueva" },
      { clave: "atendido", nombre: "Atendido" },
    ],
  },
};

describe("esquema de config/cliente.ts", () => {
  it("acepta una configuracion minima y completa los defaults", () => {
    const r = esquemaConfig.safeParse(BASE);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.marca.colorPrimario).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(r.data.idioma).toBeTruthy();
      expect(r.data.pipeline.etapas).toHaveLength(2);
    }
  });

  it("rechaza un pipeline con etapas repetidas", () => {
    const r = esquemaConfig.safeParse({
      ...BASE,
      pipeline: {
        etapas: [
          { clave: "consulta", nombre: "Consulta nueva" },
          { clave: "consulta", nombre: "Otra consulta" },
        ],
      },
    });
    expect(r.success).toBe(false);
  });

  it("rechaza un pipeline de una sola etapa", () => {
    const r = esquemaConfig.safeParse({
      ...BASE,
      pipeline: { etapas: [{ clave: "unica", nombre: "Unica" }] },
    });
    expect(r.success).toBe(false);
  });

  it("rechaza un color que no sea #rrggbb", () => {
    const r = esquemaConfig.safeParse({
      ...BASE,
      marca: { ...BASE.marca, colorPrimario: "verde" },
    });
    expect(r.success).toBe(false);
  });

  it("rechaza una clave de etapa que no sea snake_case", () => {
    // Las claves viajan a la base y al prompt del agente: un espacio o un acento ahi
    // rompe consultas y confunde al modelo.
    const r = esquemaConfig.safeParse({
      ...BASE,
      pipeline: {
        etapas: [
          { clave: "Consulta Nueva", nombre: "Consulta nueva" },
          { clave: "atendido", nombre: "Atendido" },
        ],
      },
    });
    expect(r.success).toBe(false);
  });

  it("rechaza un campo de seleccion sin opciones", () => {
    const r = esquemaConfig.safeParse({
      ...BASE,
      contacto: {
        campos: [{ clave: "obra_social", etiqueta: "Obra social", tipo: "seleccion" }],
      },
    });
    expect(r.success).toBe(false);
  });

  it("rechaza campos del contacto con la misma clave", () => {
    const r = esquemaConfig.safeParse({
      ...BASE,
      contacto: {
        campos: [
          { clave: "obra_social", etiqueta: "Obra social", tipo: "texto" },
          { clave: "obra_social", etiqueta: "Repetido", tipo: "texto" },
        ],
      },
    });
    expect(r.success).toBe(false);
  });

  it("acepta una zona horaria IANA y usa UTC si no se declara", () => {
    // UTC por default a proposito: una instancia ya desplegada que actualiza el nucleo
    // sin tocar su configuracion sigue viendo las mismas fechas que antes.
    expect(esquemaConfig.safeParse(BASE).data?.zonaHoraria).toBe("UTC");
    const r = esquemaConfig.safeParse({ ...BASE, zonaHoraria: "America/Mexico_City" });
    expect(r.success).toBe(true);
  });

  it("rechaza una zona horaria mal escrita", () => {
    // Es la clase de error que no avisa: Intl la rechaza al formatear, lejos de aqui, y
    // el sintoma es un agente que nombra el dia equivocado.
    const r = esquemaConfig.safeParse({ ...BASE, zonaHoraria: "America/Santigo" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain("America/Santigo");
    }
  });

  it("explica donde esta el problema, no solo que lo hay", () => {
    const r = esquemaConfig.safeParse({ ...BASE, marca: { nombreCorto: "Norte" } });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path.join(".")).toContain("marca");
    }
  });
});
