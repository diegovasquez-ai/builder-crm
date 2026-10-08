import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { modoLocal } from "@/lib/modo-local";

// `/correo` sirve las plantillas de los correos de acceso: las descarga el servidor de
// autenticacion, que no tiene sesion en el CRM. Son plantillas vacias, sin datos.
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/sin-acceso", "/correo"];
// `/api/automations/process` es el sweeper (lo llama el cron con secreto); el resto
// de /api/automations exige sesion.
// Rutas con autenticacion propia (secreto del worker o admin con sesion, resuelto en
// la ruta): el middleware no las manda a /login.
const PUBLIC_API_PREFIXES = [
  "/api/health",
  "/api/webhooks",
  "/api/agent",
  "/api/automations/process",
  "/api/simulador",
  "/api/seed",
];

export async function updateSession(request: NextRequest) {
  // Modo local: no hay servidor de autenticacion al que preguntarle. Sin esta salida,
  // `createServerClient` recibe undefined y TODA peticion muere antes de renderizar;
  // eso es lo que hacia que el CRM no abriera sin un proyecto de Supabase.
  if (modoLocal()) return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const isPublicApi = PUBLIC_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!user && !isPublicPath && !isPublicApi) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
