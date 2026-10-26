import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { opcionesDeCookie } from "@/lib/supabase/cookies";

/**
 * La cookie de sesion lleva el JWT de acceso y el token de refresco. Sin `secure`, el
 * navegador la adjunta tambien a una peticion `http://` al dominio del CRM, y quien
 * mire esa peticion se lleva la sesion entera.
 *
 * Se prueba aparte porque el sintoma de perderlo es ninguno: la aplicacion funciona
 * identico con la cookie insegura.
 */

const ORIGINAL = { ...process.env };

function entorno(clave: string, valor: string) {
  (process.env as Record<string, string | undefined>)[clave] = valor;
}

afterEach(() => {
  process.env = { ...ORIGINAL };
});

beforeEach(() => {
  entorno("NODE_ENV", "production");
});

describe("cookies de sesion", () => {
  it("en produccion van con secure, httpOnly y sameSite", () => {
    expect(opcionesDeCookie()).toEqual({
      secure: true,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
  });

  it("en desarrollo secure queda apagado", () => {
    // http://localhost no tiene certificado: con secure el navegador descarta la cookie
    // y no se puede iniciar sesion en local.
    entorno("NODE_ENV", "development");
    expect(opcionesDeCookie().secure).toBe(false);
    expect(opcionesDeCookie().httpOnly).toBe(true);
  });
});
