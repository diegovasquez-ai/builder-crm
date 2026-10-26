import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { autorizadoPorSecreto } from "@/lib/secreto-worker";

/**
 * `/api/agent/process`, los dos barridos y la carga de datos demo son publicas en el
 * middleware: las llama un cron o el propio servidor, sin sesion. Este secreto es lo
 * UNICO que las separa de internet.
 *
 * Hasta 1.6.1 la comprobacion era `if (secret) { ...comprobar... }`, asi que una
 * instancia sin la variable las dejaba abiertas y no habia ningun sintoma: el CRM
 * funcionaba igual. Eso es lo que prueba el primer caso, y es el que no puede volver a
 * romperse.
 */

const ORIGINAL = { ...process.env };

function peticion(cabeceras: Record<string, string>): NextRequest {
  return {
    headers: { get: (n: string) => cabeceras[n.toLowerCase()] ?? null },
  } as unknown as NextRequest;
}

beforeEach(() => {
  delete process.env.AGENT_WORKER_SECRET;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("secreto de las rutas internas", () => {
  it("sin la variable configurada NO autoriza a nadie", () => {
    expect(autorizadoPorSecreto(peticion({}))).toBe(false);
    expect(autorizadoPorSecreto(peticion({ "x-agent-secret": "lo-que-sea" }))).toBe(false);
    expect(autorizadoPorSecreto(peticion({ authorization: "Bearer lo-que-sea" }))).toBe(false);
  });

  it("acepta el secreto correcto por las dos vias", () => {
    process.env.AGENT_WORKER_SECRET = "a".repeat(64);
    expect(autorizadoPorSecreto(peticion({ "x-agent-secret": "a".repeat(64) }))).toBe(true);
    expect(autorizadoPorSecreto(peticion({ authorization: `Bearer ${"a".repeat(64)}` }))).toBe(true);
  });

  it("rechaza un secreto distinto, aunque mida lo mismo", () => {
    process.env.AGENT_WORKER_SECRET = "a".repeat(64);
    expect(autorizadoPorSecreto(peticion({ "x-agent-secret": "b".repeat(64) }))).toBe(false);
  });

  it("no revienta con secretos de otra longitud", () => {
    // timingSafeEqual lanza si los buffers no miden igual: hay que cortar antes.
    process.env.AGENT_WORKER_SECRET = "a".repeat(64);
    expect(autorizadoPorSecreto(peticion({ "x-agent-secret": "a" }))).toBe(false);
    expect(autorizadoPorSecreto(peticion({ "x-agent-secret": "a".repeat(200) }))).toBe(false);
  });

  it("una cabecera vacia no vale como secreto", () => {
    process.env.AGENT_WORKER_SECRET = "a".repeat(64);
    expect(autorizadoPorSecreto(peticion({ "x-agent-secret": "" }))).toBe(false);
    expect(autorizadoPorSecreto(peticion({ authorization: "Bearer " }))).toBe(false);
  });
});
