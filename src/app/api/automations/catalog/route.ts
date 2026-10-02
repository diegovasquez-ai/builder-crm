import { NextResponse } from "next/server";
import { requireMember } from "@/lib/api-auth";
import { getCatalog } from "@/lib/automations";

export const dynamic = "force-dynamic";

/** Disparadores y acciones disponibles, con sus opciones ya resueltas. */
export async function GET() {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await getCatalog());
}
