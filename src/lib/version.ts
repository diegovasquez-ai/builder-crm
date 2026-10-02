/**
 * Version y commit de lo que esta corriendo. La version sale de package.json y se
 * congela al construir (next.config.ts la expone como NEXT_PUBLIC_APP_VERSION). El
 * commit solo si llego al build como SOURCE_COMMIT (Coolify y docker compose lo pasan
 * como build arg); si no, la app muestra solo la version.
 *
 * Se ve en /api/health y abajo en la barra lateral, para confirmar un despliegue con
 * un curl sin abrir la app.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const BUILD_COMMIT = process.env.NEXT_PUBLIC_BUILD_COMMIT || null;

export function etiquetaVersion(): string {
  const commit = BUILD_COMMIT ? ` · ${BUILD_COMMIT.slice(0, 7)}` : "";
  return `v${APP_VERSION}${commit}`;
}
