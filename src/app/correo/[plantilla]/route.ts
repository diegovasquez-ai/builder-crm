import { NextResponse } from "next/server";
import { esPlantilla, plantillaCorreo } from "@/lib/plantillas-correo";
import { urlPublica } from "@/lib/auth-correo";

/**
 * Plantillas de los correos de acceso, en HTML y con la marca de la instancia.
 *
 *   GET /correo/invitacion.html
 *   GET /correo/recuperacion.html
 *
 * Es publica (esta en la lista del middleware) porque la descarga el servidor de
 * autenticacion, que no tiene sesion en el CRM. No expone nada: es la plantilla vacia,
 * sin datos de nadie; el enlace y el destinatario los pone GoTrue al enviar.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ plantilla: string }> }
) {
  const { plantilla } = await params;
  const nombre = plantilla.replace(/\.html$/, "");
  if (!esPlantilla(nombre)) {
    return NextResponse.json({ error: "Plantilla desconocida" }, { status: 404 });
  }
  return new NextResponse(plantillaCorreo(nombre, urlPublica()), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // GoTrue la relee cada tanto: que no se quede con una version vieja de la marca.
      "Cache-Control": "public, max-age=60",
    },
  });
}
