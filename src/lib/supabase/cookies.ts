/**
 * Opciones de las cookies de sesion, compartidas por el middleware y el cliente de
 * servidor para que no se puedan desincronizar.
 *
 * `@supabase/ssr` trae `path`, `sameSite`, `httpOnly` y `maxAge` por defecto, pero NO
 * `secure`. Sin ese atributo el navegador adjunta `sb-*-auth-token` —el JWT de acceso y
 * el token de refresco— a cualquier peticion `http://` al dominio del CRM: la primera
 * visita escrita a mano, un enlace viejo, una red hostil. Quien mire esa peticion se
 * lleva la sesion entera.
 *
 * En desarrollo `secure` queda apagado, porque `http://localhost` no tiene certificado y
 * si no el navegador descarta la cookie y no se puede iniciar sesion.
 */
export function opcionesDeCookie() {
  return {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    httpOnly: true,
    path: "/",
  };
}
