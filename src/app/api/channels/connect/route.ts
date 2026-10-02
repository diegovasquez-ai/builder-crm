import { NextRequest, NextResponse } from "next/server";
import { buildConnectUrl } from "@/lib/zernio/accounts";
import { isChannel } from "@/lib/channels/types";
import { requireMember } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Paso 1 del OAuth: el SERVIDOR le pide a Zernio la URL de autorizacion y devuelve solo
 * esa URL. La API key nunca llega al browser, que la abre en un popup.
 */
export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const params = request.nextUrl.searchParams;
  const platform = params.get("platform");

  if (!isChannel(platform)) {
    return NextResponse.json(
      { error: "platform invalido (whatsapp | instagram | facebook)" },
      { status: 400 }
    );
  }

  const origin =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin;
  const redirectUrl = `${origin.replace(/\/$/, "")}/api/channels/callback`;

  const onboarding = params.get("onboarding");
  const loginMethod = params.get("loginMethod");

  const result = await buildConnectUrl(platform, redirectUrl, {
    // `business_app` (coexistencia) es el default: el numero sigue vivo en el celular.
    // `api` muestra el selector de WABA de Meta y sirve para un numero que YA esta en
    // Cloud API en otro lado. Un numero que esta en la app WhatsApp Business aparece
    // como "no cumple los requisitos" en el flujo `api`: ese es el sintoma de haber
    // elegido el modo equivocado, no un problema del numero.
    onboarding: onboarding === "api" ? "api" : "business_app",
    loginMethod: loginMethod === "facebook_login" ? "facebook_login" : undefined,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error.status || 502 }
    );
  }

  return NextResponse.json({ authUrl: result.data.authUrl });
}
