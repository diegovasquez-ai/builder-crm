import { NextRequest, NextResponse } from "next/server";
import { upsertZernioAccount } from "@/lib/channels/accounts";
import { getAccount } from "@/lib/zernio/accounts";
import { isChannel } from "@/lib/channels/types";
import { resolveDefaultTenantId } from "@/lib/tenants";
import { requireMember } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Vuelta del OAuth de Zernio: `?connected=<platform>&profileId=&accountId=&username=`.
 *
 * Se abre dentro de un popup, asi que en vez de redirigir devuelve una pagina minima que
 * le avisa al CRM por `postMessage` y se cierra sola. Si no hay `opener` (popup
 * bloqueado, o alguien pego la URL a mano) cae al redirect de siempre.
 *
 * El webhook `account.connected` guarda lo mismo de forma idempotente: esto es UX para
 * que la cuenta aparezca al instante, no la fuente de verdad.
 *
 * Lo que llega en la URL NO se cree: se le pregunta a Zernio por ese `accountId` con la
 * clave de esta instancia antes de guardarlo. Sin esa comprobacion, un enlace preparado
 * y abierto por cualquiera del equipo conectaba al CRM una cuenta ajena, porque el
 * identificador venia del query y nadie verificaba que esa conexion la hubiera iniciado
 * este CRM. La clave de la API solo ve las cuentas propias, asi que una ajena no existe.
 */
export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const params = request.nextUrl.searchParams;
  const platform = params.get("connected");
  const accountId = params.get("accountId");
  const username = params.get("username");

  let ok = false;

  if (isChannel(platform) && accountId) {
    const cuenta = await getAccount(accountId);
    if (!cuenta.success) {
      console.warn(
        `[channels] la vuelta del OAuth trae un accountId que Zernio no reconoce (${accountId}): se ignora`
      );
    } else if (cuenta.data.platform !== platform) {
      console.warn(
        `[channels] el accountId ${accountId} es de ${cuenta.data.platform}, no de ${platform}: se ignora`
      );
    } else {
      const tenantId = await resolveDefaultTenantId();
      if (tenantId) {
        await upsertZernioAccount({
          tenantId,
          platform,
          // Lo que se guarda sale de la respuesta de Zernio, no del query.
          zernioAccountId: cuenta.data.id,
          zernioProfileId: cuenta.data.profileId ?? params.get("profileId"),
          username: cuenta.data.username ?? username,
          displayName: cuenta.data.displayName ?? cuenta.data.name ?? username,
        });
        ok = true;
      }
    }
  }

  // Origen REAL desde donde se sirve esta pagina, no el de la env: el opener es
  // same-origin con ella por definicion, y si NEXT_PUBLIC_APP_URL no coincide exacto
  // (otro puerto en dev, por ejemplo) el postMessage se descarta sin avisar.
  const origin = request.nextUrl.origin;

  return new NextResponse(
    popupHtml({
      origin: origin.replace(/\/$/, ""),
      payload: {
        ok,
        platform: platform ?? null,
        accountId,
        username,
        error: ok ? null : params.get("error") ?? "No se pudo conectar la cuenta",
      },
    }),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

interface PopupHtmlArgs {
  origin: string;
  payload: Record<string, unknown>;
}

function popupHtml({ origin, payload }: PopupHtmlArgs): string {
  // Escapar `<` evita que un username con markup pueda cerrar el <script>.
  const data = JSON.stringify({ source: "zernio-connect", ...payload }).replace(
    /</g,
    "\\u003c"
  );
  const target = JSON.stringify(origin);
  const fallback = JSON.stringify(
    `${origin}/settings?canal=${payload.platform ?? "desconocido"}&estado=${payload.ok ? "ok" : "error"}`
  );

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Conectando…</title></head>
<body style="font:14px/1.5 system-ui,sans-serif;padding:32px;color:#334155">
<p>${payload.ok ? "Cuenta conectada. Podés cerrar esta ventana." : "No se pudo conectar la cuenta."}</p>
<script>
(function () {
  var data = ${data};
  if (window.opener && !window.opener.closed) {
    try { window.opener.postMessage(data, ${target}); } catch (e) {}
    window.close();
  } else {
    location.replace(${fallback});
  }
})();
</script>
</body>
</html>`;
}
