import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyZernioSignature } from "@/lib/zernio/webhooks";

/**
 * La firma del webhook es la unica puerta de `/api/webhooks/zernio`, que es publica por
 * necesidad. Si deja de validar, cualquiera puede inyectar mensajes falsos en la bandeja
 * de un cliente, hacer que el agente les conteste y mover su pipeline. Y no se nota:
 * los mensajes entran, se ven normales.
 */

const SECRETO = "un-secreto-de-prueba";
const CUERPO = JSON.stringify({ event: "message.received", data: { id: "abc" } });

function firmar(cuerpo: string, secreto = SECRETO): string {
  return crypto.createHmac("sha256", secreto).update(cuerpo).digest("hex");
}

describe("firma del webhook de Zernio", () => {
  it("acepta un cuerpo firmado con el secreto correcto", () => {
    expect(verifyZernioSignature(CUERPO, firmar(CUERPO), SECRETO)).toBe(true);
  });

  it("rechaza si no hay secreto configurado (fail-closed)", () => {
    // El caso que importa: una instancia a la que se le olvido la variable NO debe
    // quedar abierta. Antes que entren mensajes falsos, que no entre ninguno.
    expect(verifyZernioSignature(CUERPO, firmar(CUERPO), "")).toBe(false);
  });

  it("rechaza si no viene la cabecera de firma", () => {
    expect(verifyZernioSignature(CUERPO, null, SECRETO)).toBe(false);
    expect(verifyZernioSignature(CUERPO, undefined, SECRETO)).toBe(false);
  });

  it("rechaza una firma hecha con otro secreto", () => {
    expect(verifyZernioSignature(CUERPO, firmar(CUERPO, "otro-secreto"), SECRETO)).toBe(false);
  });

  it("rechaza si el cuerpo cambio un solo caracter despues de firmar", () => {
    const firma = firmar(CUERPO);
    const alterado = CUERPO.replace('"abc"', '"abd"');
    expect(verifyZernioSignature(alterado, firma, SECRETO)).toBe(false);
  });

  it("rechaza una firma de largo distinto sin romperse", () => {
    // timingSafeEqual lanza si los buffers miden distinto: comparar el largo antes no es
    // cosmetico, es lo que evita que una firma corta tire una excepcion en el webhook.
    expect(() => verifyZernioSignature(CUERPO, "abc123", SECRETO)).not.toThrow();
    expect(verifyZernioSignature(CUERPO, "abc123", SECRETO)).toBe(false);
  });

  it("tolera el prefijo sha256= y las mayusculas", () => {
    // Meta lo manda asi y Zernio no; aceptar las dos formas evita un 401 silencioso el
    // dia que se cambie de proveedor.
    const firma = firmar(CUERPO);
    expect(verifyZernioSignature(CUERPO, `sha256=${firma}`, SECRETO)).toBe(true);
    expect(verifyZernioSignature(CUERPO, firma.toUpperCase(), SECRETO)).toBe(true);
  });
});
