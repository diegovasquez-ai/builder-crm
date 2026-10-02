import { NextResponse } from "next/server";
import { syncAccountsFromZernio } from "@/lib/channels/sync";
import { requireMember } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const result = await syncAccountsFromZernio();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
