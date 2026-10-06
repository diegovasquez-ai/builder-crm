import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  configPublica,
  configPublicaSerializada,
  ID_CONFIG_PUBLICA,
} from "@/lib/config-publica";

/**
 * Este bloque JSON se incrusta dentro de una etiqueta <script> en todas las paginas. Dos
 * cosas tienen que seguir siendo ciertas: que no se pueda cerrar la etiqueta desde el
 * contenido (seria inyeccion de codigo en el navegador de cada persona del equipo) y que
 * el valor que ve el navegador sea el del entorno, no uno horneado en el build.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth.ejemplo.com";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "clave-anonima";
  delete process.env.AUTH_ENVIA_CORREOS;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("configuracion publica", () => {
  it("lleva la URL y la clave anonima del entorno", () => {
    expect(configPublica()).toMatchObject({
      supabaseUrl: "https://auth.ejemplo.com",
      supabaseAnonKey: "clave-anonima",
    });
  });

  it("escapa el menor-que para que no se pueda cerrar la etiqueta script", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.com/</script><script>alert(1)</script>";
    const json = configPublicaSerializada();
    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c");
    // Y lo escapado sigue siendo JSON valido con el valor intacto.
    expect(JSON.parse(json).supabaseUrl).toContain("</script>");
  });

  it("declara el correo solo cuando la variable lo dice", () => {
    expect(configPublica().authEnviaCorreos).toBe(false);
    process.env.AUTH_ENVIA_CORREOS = "true";
    expect(configPublica().authEnviaCorreos).toBe(true);
    process.env.AUTH_ENVIA_CORREOS = "false";
    expect(configPublica().authEnviaCorreos).toBe(false);
  });

  it("no cambia el id del bloque sin querer", () => {
    // El layout lo escribe y el navegador lo busca por este id: si cambia en un lado y
    // no en el otro, el cliente de Supabase del navegador nace vacio y nada avisa.
    expect(ID_CONFIG_PUBLICA).toBe("builder-crm-config");
  });
});
