/**
 * Arranque del servidor (Next.js lo llama una vez por proceso).
 *
 * - Avisa en el log que variables obligatorias faltan (sin valores).
 * - Fuera de Vercel, enciende los barridos de recuperacion en el proceso.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { envFaltantes } = await import("./lib/env");
  const faltan = envFaltantes();
  if (faltan.length > 0) {
    console.error(`[boot] faltan variables obligatorias: ${faltan.join(", ")} (ver .env.example)`);
  }

  const { erroresConfig } = await import("./lib/config");
  const problemas = erroresConfig();
  if (problemas.length > 0) {
    console.error(`[boot] config/cliente.ts invalido:\n${problemas.map((p) => `  - ${p}`).join("\n")}`);
  } else if (faltan.length === 0) {
    // El pipeline de config/cliente.ts existe en la base antes de atender la primera
    // request. Si la base no esta, se avisa y la app arranca igual.
    try {
      const { sincronizarPipeline } = await import("./lib/pipeline/sincronizar");
      const r = await sincronizarPipeline();
      console.log(`[boot] pipeline sincronizado: ${r.creadas} creadas, ${r.actualizadas} actualizadas, ${r.conservadas} conservadas`);
    } catch (err) {
      console.error("[boot] no se pudo sincronizar el pipeline:", err instanceof Error ? err.message : err);
    }
  }

  if (process.env.VERCEL || process.env.SWEEPERS_DISABLED === "true") return;
  const { iniciarBarridos } = await import("./lib/barridos");
  iniciarBarridos();
}
