import { modoLocal } from "@/lib/modo-local";

/**
 * Configuracion publica que necesita el navegador, servida en tiempo de EJECUCION.
 *
 * Next hornea las `NEXT_PUBLIC_*` durante el build. Eso obliga a conocer la URL de
 * Supabase al compilar la imagen, y en un modelo de una instancia por cliente no se
 * conoce: la imagen es la misma y cada instancia apunta a su propio proyecto. Peor aun,
 * la API de Coolify 4.3 no permite marcar una variable como de build, asi que el valor
 * llegaba vacio al bundle y el cliente de Supabase del navegador nacia roto, sin ningun
 * error visible: el menu de usuario se quedaba en gris para siempre.
 *
 * Por eso el layout escribe estos valores en un bloque JSON y el navegador los lee de
 * ahi. Son publicos por diseno: la clave anonima ya viajaba en el bundle. Lo que protege
 * los datos es RLS mas la autorizacion del servidor, nunca el secreto de esta clave.
 */

export interface ConfigPublica {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /**
   * El servidor de autenticacion de esta instancia manda correos: hay invitaciones por
   * correo y "olvide mi contrasena". No es un secreto ni una credencial, es una
   * capacidad: la UI necesita saberlo para no ofrecer un boton que no hace nada.
   */
  authEnviaCorreos: boolean;
  /**
   * El CRM corre en la maquina de alguien con la base embebida y sin sesion (ver
   * src/lib/modo-local.ts). El navegador lo necesita para avisar que esto no es una
   * instancia de verdad y para no ofrecer "cerrar sesion", que no tendria a donde ir.
   */
  modoLocal: boolean;
}

/** `AUTH_ENVIA_CORREOS=true`. Se aceptan las formas de siempre para no pelear con ellas. */
function leerBooleano(valor: string | undefined): boolean {
  return ["true", "1", "si", "sí", "yes", "on"].includes((valor ?? "").trim().toLowerCase());
}

export const ID_CONFIG_PUBLICA = "builder-crm-config";

export function configPublica(): ConfigPublica {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    authEnviaCorreos: leerBooleano(process.env.AUTH_ENVIA_CORREOS),
    modoLocal: modoLocal(),
  };
}

/** JSON listo para incrustar: escapa `<` para no poder cerrar la etiqueta. */
export function configPublicaSerializada(): string {
  return JSON.stringify(configPublica()).replace(/</g, "\\u003c");
}

/** Lee el bloque del documento. Solo en el navegador. */
export function leerConfigPublica(): ConfigPublica {
  if (typeof document !== "undefined") {
    const bloque = document.getElementById(ID_CONFIG_PUBLICA)?.textContent;
    if (bloque) {
      try {
        const datos = JSON.parse(bloque) as Partial<ConfigPublica>;
        // En modo local no hay URL ni clave de Supabase, y el bloque vale igual: es
        // justamente el que le dice al navegador que esta en modo local.
        if (datos.modoLocal === true || (datos.supabaseUrl && datos.supabaseAnonKey)) {
          return {
            supabaseUrl: datos.supabaseUrl ?? "",
            supabaseAnonKey: datos.supabaseAnonKey ?? "",
            authEnviaCorreos: datos.authEnviaCorreos === true,
            modoLocal: datos.modoLocal === true,
          };
        }
      } catch {
        /* sigue con las variables del build */
      }
    }
  }
  // Vercel y desarrollo local: ahi las NEXT_PUBLIC_* si estan en el bundle. En el
  // servidor (SSR de un componente cliente) se lee el entorno completo.
  return configPublica();
}
