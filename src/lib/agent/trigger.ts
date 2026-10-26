import { queueConfig } from "./queue";

/**
 * Dispara el worker del agente para una lista de jobs.
 *
 * Estaba inline dentro del webhook de WhatsApp; lo necesita tambien el de Zernio, asi
 * que vive aca. Se llama SIEMPRE desde dentro de un `after()`: la idea es devolverle
 * 200 al proveedor primero y recien despues esperar el debounce.
 *
 * Cada job hace su propio debounce: si llegan mas mensajes del mismo hilo en los
 * proximos segundos, este worker corre pero `claimAgentJob` detecta
 * `debounce_still_active` y se sale; el siguiente setTimeout lo procesa.
 */
export async function triggerAgentWorker(
  jobIds: string[],
  baseUrl: string,
  tag = "agent-trigger"
): Promise<void> {
  const unique = Array.from(new Set(jobIds)).filter(Boolean);
  if (unique.length === 0) return;

  // Sin URL publica no se llama a nadie: `getWorkerBaseUrl` devuelve vacio en produccion
  // cuando falta APP_BASE_URL, justamente para no mandar el secreto a un host que vino
  // en una cabecera. Los jobs quedan en la cola y los levanta el barrido.
  if (!baseUrl) {
    console.error(`[${tag}] sin APP_BASE_URL no se dispara el worker; quedan ${unique.length} en cola`);
    return;
  }

  const secret = process.env.AGENT_WORKER_SECRET;

  await Promise.all(
    unique.map(async (jobId) => {
      await new Promise((r) => setTimeout(r, queueConfig.debounceMs + 250));
      try {
        const res = await fetch(`${baseUrl}/api/agent/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(secret ? { "x-agent-secret": secret } : {}),
          },
          body: JSON.stringify({ jobId }),
        });
        if (!res.ok) {
          console.warn(
            `[${tag}] agent worker no-200`,
            res.status,
            await res.text().catch(() => "")
          );
        }
      } catch (err) {
        console.error(`[${tag}] error disparando worker`, err);
      }
    })
  );
}

/**
 * URL publica de la app para que el webhook pueda llamarse a si mismo.
 *
 * A esta URL se le manda AGENT_WORKER_SECRET en una cabecera, asi que NO puede salir de
 * la peticion entrante: quien controle el `Host` de una peticion que llegue hasta aca se
 * lleva el secreto a su propio servidor. Hoy el camino esta detras de la firma HMAC del
 * webhook, pero eso es una defensa de otro, no de esta funcion.
 *
 * En produccion se exige APP_BASE_URL (o NEXT_PUBLIC_APP_URL). Si falta, se devuelve
 * cadena vacia y quien llama no dispara nada: el agente queda sin procesar y queda dicho
 * en el log, que es preferible a filtrar el secreto. Fuera de produccion se cae a
 * localhost, que es donde corre `npm run dev`.
 */
export function getWorkerBaseUrl(_headers?: Headers): string {
  const fromEnv = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    console.error(
      "[seguridad] falta APP_BASE_URL: no se llama al worker del agente. " +
        "Derivar la URL del host de la peticion filtraria AGENT_WORKER_SECRET."
    );
    return "";
  }

  return "http://localhost:3000";
}
