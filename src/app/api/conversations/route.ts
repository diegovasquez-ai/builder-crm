import { NextRequest, NextResponse } from "next/server";
import { listConversations } from "@/lib/conversations";
import { isChannel } from "@/lib/channels/types";
import { requireMember } from "@/lib/api-auth";
import { visibleOwnerId } from "@/lib/team";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  const channel = request.nextUrl.searchParams.get("channel");
  const items = await listConversations({
    channel: isChannel(channel) ? channel : undefined,
    ownerId: visibleOwnerId(auth.member),
  });
  return NextResponse.json(items);
}
