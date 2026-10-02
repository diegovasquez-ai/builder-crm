import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/team";

export const dynamic = "force-dynamic";

/** Quien soy y que rol tengo. La UI lo usa para mostrar u ocultar lo de admin. */
export async function GET() {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ member: null }, { status: 403 });
  return NextResponse.json({ member });
}
