import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { configPublica } from "@/lib/config-publica";

/**
 * Correos de acceso: invitaciones al equipo y "olvide mi contrasena".
 *
 * Los manda el servidor de autenticacion (GoTrue / Supabase), no el CRM: ahi estan las
 * credenciales de SMTP, los limites de envio y la generacion de los enlaces. El CRM solo
 * decide tres cosas, que son las que viven en este archivo: si la capacidad esta
 * encendida, a donde vuelve la persona cuando hace clic, y como se pide cada correo.
 *
 * POR QUE HACE FALTA UN INTERRUPTOR EXPLICITO: cuando GoTrue no tiene SMTP configurado
 * no falla, usa un cliente de correo "noop" que se traga el mensaje y responde 200. Sin
 * esta variable el CRM diria "invitacion enviada" sobre un correo que nunca salio, y el
 * administrador se quedaria esperando. Es el caso contrario al de los proveedores
 * externos (`auth-proveedores.ts`), que se detectan preguntandole a `/auth/v1/settings`:
 * el SMTP no aparece ahi, asi que no hay nada que preguntar.
 *
 * Como se configura (autoalojado o Supabase cloud): docs/CORREO.md
 */

/** Pagina donde la persona define su contrasena al volver del correo. */
export const RUTA_DEFINIR_CLAVE = "/auth/definir-clave";

/**
 * true si esta instancia declara que su servidor de autenticacion manda correos.
 * El valor sale de la configuracion publica, que es la que tambien ve el navegador: asi
 * el boton que ofrece la UI y lo que acepta la API no pueden contradecirse.
 */
export function correoDeAccesoActivo(): boolean {
  return configPublica().authEnviaCorreos;
}

/** URL publica de la instancia, sin barra final. Null si no esta configurada. */
export function urlPublica(): string | null {
  const base = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  return base ? base.replace(/\/$/, "") : null;
}

const SIN_BASE =
  "Falta APP_BASE_URL: sin la URL publica de la instancia el enlace del correo no sabe a donde volver.";

/**
 * Cliente anonimo de un solo uso, con flujo implicito y sin guardar nada.
 *
 * El flujo PKCE guarda un verificador en el navegador que pidio el correo, y el enlace
 * solo sirve en ese mismo navegador. Estos correos los pide el servidor (o un
 * administrador desde otra computadora), asi que PKCE los volveria inservibles: con el
 * flujo implicito el enlace funciona en cualquier dispositivo, que es justo lo que uno
 * espera de "te mande el acceso por correo".
 */
function clienteSinEstado() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return createSupabaseClient(url, anon, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Invita a alguien que todavia no tiene usuario. Crea el usuario sin contrasena y manda
 * el correo con el enlace; la contrasena la elige la persona al entrar.
 *
 * Si el correo ya tiene usuario, GoTrue responde `email_exists`: eso lo resuelve quien
 * llama (se reutiliza el usuario y se le manda un enlace de acceso).
 */
export async function invitarPorCorreo(
  email: string,
  nombre: string
): Promise<{ userId: string } | { error: string }> {
  const base = urlPublica();
  if (!base) return { error: SIN_BASE };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: nombre || null },
    redirectTo: `${base}${RUTA_DEFINIR_CLAVE}`,
  });
  if (error || !data?.user) {
    return { error: error?.message ?? "No se pudo enviar la invitacion" };
  }
  return { userId: data.user.id };
}

/**
 * Manda un enlace para definir la contrasena a alguien que ya tiene usuario: lo usa el
 * administrador ("reenviar acceso") y la pagina de "olvide mi contrasena".
 *
 * Es el endpoint publico de recuperacion del proveedor, con sus propios limites de
 * frecuencia por persona y por hora. Para no confirmar quien tiene cuenta y quien no,
 * el proveedor responde lo mismo en los dos casos.
 */
export async function enviarEnlaceDeAcceso(email: string): Promise<{ error?: string }> {
  const base = urlPublica();
  if (!base) return { error: SIN_BASE };

  try {
    const { error } = await clienteSinEstado().auth.resetPasswordForEmail(email, {
      redirectTo: `${base}${RUTA_DEFINIR_CLAVE}`,
    });
    return error ? { error: error.message } : {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo enviar el correo" };
  }
}
