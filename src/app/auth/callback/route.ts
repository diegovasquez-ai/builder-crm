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
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const descripcion = searchParams.get("error_description");
  const destino = searchParams.get("next") ?? "/";

  if (descripcion) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(descripcion)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Volviste sin codigo de autorizacion.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  // Ruta relativa siempre: evita que un `next` manipulado mande a otro sitio.
  const seguro = destino.startsWith("/") && !destino.startsWith("//") ? destino : "/";
  return NextResponse.redirect(`${origin}${seguro}`);
}
