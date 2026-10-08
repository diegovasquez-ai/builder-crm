import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { modoLocal } from "@/lib/modo-local";

/**
 * El modo local apaga la autenticacion entera: no hay sesion, no hay roles y quien abre
 * la URL es administrador. Eso esta bien en la maquina de alguien que esta probando el
 * CRM, y es una puerta abierta en la instancia de un cliente.
 *
 * Lo peligroso es que si se encendiera por error no fallaria nada: no hay excepcion, no
 * hay log, la UI se ve igual. El unico sintoma seria que cualquiera entra. Por eso el
 * segundo candado (NODE_ENV) tiene que aguantar aunque la variable venga puesta, que es
 * lo que pasa cuando alguien copia su .env.local al servidor.
 */

const ORIGINAL = { ...process.env };

// Los tipos de Next declaran NODE_ENV como de solo lectura; en el test hay que moverlo
// igual, porque el candado que se esta probando es justamente ese. Se resuelve
// `process.env` en cada llamada a proposito: afterEach lo reemplaza por un objeto nuevo
// y una referencia guardada apuntaria al viejo.
function entorno(clave: string, valor: string) {
  (process.env as Record<string, string | undefined>)[clave] = valor;
}

beforeEach(() => {
  delete process.env.MODO_LOCAL;
  // vitest corre en "test"; el valor que importa es que no sea "production".
  entorno("NODE_ENV", "development");
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("candado del modo local", () => {
  it("apagado por defecto", () => {
    expect(modoLocal()).toBe(false);
  });

  it("se enciende solo con la variable exacta", () => {
    process.env.MODO_LOCAL = "true";
    expect(modoLocal()).toBe(true);

    for (const valor of ["1", "si", "yes", "on", "TRUE", "True", ""]) {
      process.env.MODO_LOCAL = valor;
      expect(modoLocal(), `MODO_LOCAL=${valor} no deberia encenderlo`).toBe(false);
    }
  });

  it("en produccion no se enciende ni con la variable puesta", () => {
    process.env.MODO_LOCAL = "true";
    entorno("NODE_ENV", "production");
    expect(modoLocal()).toBe(false);
  });
});
