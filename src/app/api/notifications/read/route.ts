import { NextRequest, NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import { markNotificationsRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/** Marca leidas. Body `{ ids: [...] }`, o `{}` para todas. */
export async function POST(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;

  let body: { ids?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    /* sin cuerpo = todas */
  }
  const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === "string") : undefined;
  const updated = await markNotificationsRead(auth.member.id, ids);
  return NextResponse.json({ updated });
}
