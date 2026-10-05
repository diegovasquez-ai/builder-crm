import { NextResponse } from "next/server";
import { listChannelAccounts } from "@/lib/channels/sync";
import { zernioConfig } from "@/lib/zernio/client";
import { whatsappProvider } from "@/lib/channels/provider";
import { requireMember } from "@/lib/api-auth";
import { estadoConectores } from "@/lib/channels/conectores";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const [accounts, conectores] = await Promise.all([listChannelAccounts(), estadoConectores()]);
  const zernio = zernioConfig();
  return NextResponse.json({
    accounts,
    conectores,
    config: {
      hasApiKey: zernio.hasApiKey,
      hasWebhookSecret: zernio.hasWebhookSecret,
      profileId: zernio.profileId,
      whatsappProvider: whatsappProvider(),
    },
  });
}
