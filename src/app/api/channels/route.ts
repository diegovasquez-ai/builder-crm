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
  return NextResponse.json({
    accounts,
    conectores,
    config: {
      hasApiKey: zernioConfig.hasApiKey,
      hasWebhookSecret: zernioConfig.hasWebhookSecret,
      profileId: zernioConfig.profileId,
      whatsappProvider: whatsappProvider(),
    },
  });
}
