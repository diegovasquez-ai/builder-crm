import "server-only";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * El secreto que autentica a los procesos internos del CRM contra sus propias rutas:
 * el worker del agente (`/api/agent/process`), el barrido de automatizaciones, el
 * barrido de webhooks colgados y la carga de datos demo.
 *
 * Esas rutas son publicas en el middleware a proposito (las llama un cron o el propio
 * servidor, sin sesion), asi que este secreto es lo UNICO que las protege.
 *
 * FALLA CERRADA, y ese es el punto. Hasta 1.5.1 cada sitio hacia:
 *
 *     const secret = process.env.AGENT_WORKER_SECRET;
 *     if (secret) { ...comprobar... }        // sin variable, no comprobaba nada
 *
 * En una instancia donde el miembro no cargo la variable, cualquiera en internet podia
 * ejecutar trabajos del agente, relanzar eventos de webhook y sembrar datos. Y no habia
 * ningun sintoma: el CRM funcionaba igual. Por eso ahora, sin secreto, estas rutas
 * responden 401 y la variable es obligatoria (ver `src/lib/env.ts`): es preferible que
 * una instancia mal configurada se queje en `/api/health` a que quede abierta en
 * silencio.
 */

/** Compara en tiempo constante. Distinta longitud = distinto, sin mirar el contenido. */
function iguales(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual lanza si los buffers difieren en longitud: hay que comparar antes,
  // y esa comparacion si filtra la longitud del secreto, que no es lo que protege.
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** El secreto presentado por quien llama, de `Authorization: Bearer` o `x-agent-secret`. */
export function secretoPresentado(request: NextRequest): string | null {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer || request.headers.get("x-agent-secret") || null;
}

/**
 * `true` solo si hay secreto configurado Y quien llama presento ese mismo secreto.
 * Sin `AGENT_WORKER_SECRET` devuelve `false` siempre.
 */
export function autorizadoPorSecreto(request: NextRequest): boolean {
  const secreto = process.env.AGENT_WORKER_SECRET;
  if (!secreto) {
    console.error(
      "[seguridad] AGENT_WORKER_SECRET no esta configurada: se rechaza la llamada interna. " +
        "Generala con `openssl rand -hex 32` y cargala en la instancia."
    );
    return false;
  }
  const presentado = secretoPresentado(request);
  return presentado !== null && iguales(presentado, secreto);
}
