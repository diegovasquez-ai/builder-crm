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
 * En Vercel alcanza con NEXT_PUBLIC_APP_URL; el fallback lee el host de la request.
 */
export function getWorkerBaseUrl(headers: Headers): string {
  const fromEnv = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const host = headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}
