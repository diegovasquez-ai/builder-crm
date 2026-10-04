import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Vuelta del login con un proveedor externo (Google y companeros).
 *
 * El navegador manda al usuario al proveedor con `signInWithOAuth`; el proveedor lo
 * devuelve aca con un codigo, y este handler lo canjea por la sesion y deja las cookies.
 *
 * Entrar NO da acceso por si solo: quien no tenga fila en `team_members` termina en
 * `/sin-acceso`, igual que con email y contrasena. El alta la hace un administrador
 * desde Ajustes -> Equipo con el mismo correo.
 */

/**
 * Detras de un proxy, el `origin` de la peticion es la direccion interna del contenedor
 * (`https://0.0.0.0:3000`), asi que redirigir a eso manda al usuario a la nada. La
 * direccion publica sale de la configuracion, que es la fuente que no se puede falsear
 * desde fuera, y solo si falta se miran las cabeceras del proxy.
 */
function baseDelSitio(request: NextRequest, origin: string): string {
  const configurada = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (configurada) return configurada.replace(/\/$/, "");

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return origin;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const base = baseDelSitio(request, origin);
  const code = searchParams.get("code");
  const descripcion = searchParams.get("error_description");
  const destino = searchParams.get("next") ?? "/";

  if (descripcion) {
    return NextResponse.redirect(`${base}/login?error=${encodeURIComponent(descripcion)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${base}/login?error=${encodeURIComponent("Volviste sin codigo de autorizacion.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${base}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Ruta relativa siempre: evita que un `next` manipulado mande a otro sitio.
  const seguro = destino.startsWith("/") && !destino.startsWith("//") ? destino : "/";
  return NextResponse.redirect(`${base}${seguro}`);
}
