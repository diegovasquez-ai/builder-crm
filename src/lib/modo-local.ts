/**
 * MODO LOCAL: el CRM corriendo en la maquina de alguien, sin cuentas de nada.
 *
 * Para probarlo y adaptarlo no hace falta un proyecto de Supabase: `npm run local`
 * levanta un Postgres embebido (un paquete de npm, nada de Docker), aplica las mismas
 * migraciones que una instancia de verdad, carga datos demo y entra directo como un
 * administrador de mentira. Sin pantalla de login, porque no hay servidor de
 * autenticacion que la conteste.
 *
 * ESO ES EXACTAMENTE LO QUE LO HACE PELIGROSO. En modo local no hay sesion, no hay
 * roles y no hay nadie verificando nada: cualquiera que abra la URL es administrador.
 * Si esto se encendiera en una instancia desplegada, el CRM de un cliente quedaria
 * abierto a internet y no fallaria nada, no habria ningun error en los logs y la UI se
 * veria normal. Por eso:
 *
 *   1. Hace falta MODO_LOCAL=true, que `npm run local` pone y nadie mas.
 *   2. Y ademas NODE_ENV distinto de "production". `next build` + `next start` y la
 *      imagen de Docker corren en production, asi que el modo local es imposible ahi
 *      aunque la variable este puesta por error o por copiar un .env ajeno.
 *
 * El segundo candado es el que importa: el primero se puede filtrar en un `.env` que
 * alguien copie de su maquina al servidor; el segundo no depende de la configuracion.
 */

/** Id fijo del administrador de mentira del modo local. */
export const ID_MIEMBRO_LOCAL = "00000000-0000-4000-8000-000000000001";
export const EMAIL_MIEMBRO_LOCAL = "demo@local";
export const NOMBRE_MIEMBRO_LOCAL = "Cuenta demo";

/** Carpeta (relativa a la raiz del repo) donde vive la base embebida. */
export const CARPETA_BASE_LOCAL = ".local/db";

export function modoLocal(): boolean {
  return process.env.MODO_LOCAL === "true" && process.env.NODE_ENV !== "production";
}
