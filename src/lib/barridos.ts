/**
 * Barridos de recuperacion dentro del proceso (para Coolify / docker / cualquier host
 * con un proceso Node vivo).
 *
 * El camino normal no necesita esto: un mensaje entrante se contesta en ~7 s por el
 * webhook y `after()`. Pero si ese `after()` muere a mitad de camino, quedan jobs del
 * agente, eventos de webhook y corridas de automatizacion a medio procesar. Estos
 * barridos pegan cada SWEEP_INTERVAL_MIN (default 30) a los mismos endpoints que
 * usaba el cron de GitHub Actions, con el mismo secreto. En Vercel no corren (ahi
 * manda vercel.json + .github/workflows/sweepers.yml).
 */

const ENDPOINTS = [
  "/api/agent/process",
  "/api/webhooks/zernio",
  "/api/automations/process",
];

declare global {
  var __builderBarridos: ReturnType<typeof setInterval> | undefined;
}

export function iniciarBarridos() {
  if (globalThis.__builderBarridos) return;

  const secreto = process.env.AGENT_WORKER_SECRET;
  if (!secreto) {
    console.warn("[barridos] AGENT_WORKER_SECRET vacio: los barridos no arrancan");
    return;
  }

  const minutos = Number(process.env.SWEEP_INTERVAL_MIN) || 30;
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`;

  const correr = async () => {
    for (const ruta of ENDPOINTS) {
      try {
        const res = await fetch(base + ruta, {
          headers: { authorization: `Bearer ${secreto}` },
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) console.warn(`[barridos] ${ruta} -> ${res.status}`);
      } catch (err) {
        console.warn(`[barridos] ${ruta} fallo:`, err instanceof Error ? err.message : err);
      }
    }
  };

  // Primer barrido al minuto de arrancar (deja que el servidor termine de levantar).
  const primero = setTimeout(correr, 60_000);
  primero.unref?.();
  globalThis.__builderBarridos = setInterval(correr, minutos * 60_000);
  globalThis.__builderBarridos.unref?.();
  console.log(`[barridos] activos cada ${minutos} min`);
}
