import { describe, it, expect, vi } from "vitest";

/**
 * Las plantillas las descarga el servidor de autenticacion y las rellena el: si se pierde
 * un marcador, el correo sale sin el enlace y la persona no puede entrar. Y como el
 * nombre de la marca lo escribe cada miembro en su `config/cliente.ts`, tiene que salir
 * escapado o un `&` deja el correo roto en la mitad de los clientes de correo.
 */

vi.mock("@/lib/config", async () => {
  const real = await vi.importActual<typeof import("@/lib/config")>("@/lib/config");
  return {
    ...real,
    marca: () => ({
      nombre: 'Clinica <Norte> & Asociados',
      nombreCorto: "Norte",
      descripcion: "Turnos por WhatsApp",
      logo: "/marca/logo.png",
      icono: "/marca/icono.png",
      colorPrimario: "#0E7C7B",
      colorSidebar: "#102A33",
    }),
  };
});

const { plantillaCorreo, esPlantilla, PLANTILLAS } = await import("@/lib/plantillas-correo");

describe("plantillas de los correos de acceso", () => {
  it("solo conoce las dos plantillas que existen", () => {
    expect([...PLANTILLAS]).toEqual(["invitacion", "recuperacion"]);
    expect(esPlantilla("invitacion")).toBe(true);
    expect(esPlantilla("recuperacion")).toBe(true);
    expect(esPlantilla("../../etc/passwd")).toBe(false);
    expect(esPlantilla("cualquier-cosa")).toBe(false);
  });

  it("conserva los marcadores que rellena el servidor de autenticacion", () => {
    for (const tipo of PLANTILLAS) {
      const html = plantillaCorreo(tipo, "https://crm.ejemplo.com");
      expect(html).toContain("{{ .ConfirmationURL }}");
      expect(html).toContain("{{ .Email }}");
    }
  });

  it("escapa el nombre de la marca", () => {
    const html = plantillaCorreo("invitacion", "https://crm.ejemplo.com");
    expect(html).toContain("Clinica &lt;Norte&gt; &amp; Asociados");
    expect(html).not.toContain("<Norte>");
  });

  it("usa el color de la marca y un logo absoluto", () => {
    // En un correo no hay rutas relativas: sin la URL publica delante, el logo no carga.
    const html = plantillaCorreo("invitacion", "https://crm.ejemplo.com");
    expect(html).toContain("#0E7C7B");
    expect(html).toContain("https://crm.ejemplo.com/marca/logo.png");
  });

  it("se arma igual sin URL publica, pero sin logo roto", () => {
    const html = plantillaCorreo("recuperacion", null);
    expect(html).toContain("{{ .ConfirmationURL }}");
    expect(html).not.toContain("<img");
  });
});
