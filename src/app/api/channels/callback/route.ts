import { NextRequest, NextResponse } from "next/server";
import { upsertZernioAccount } from "@/lib/channels/accounts";
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
    const tenantId = await resolveDefaultTenantId();
    if (tenantId) {
      await upsertZernioAccount({
        tenantId,
        platform,
        zernioAccountId: accountId,
        zernioProfileId: params.get("profileId"),
        username,
        displayName: username,
      });
      ok = true;
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
