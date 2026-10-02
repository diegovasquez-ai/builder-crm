import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireMember } from "@/lib/api-auth";
import {
  createAutomation,
  listAutomations,
  validateAutomation,
  type AutomationInput,
} from "@/lib/automations";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await listAutomations());
}

/** Crear una regla (solo admin). El cuerpo se valida contra el catalogo. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  let body: AutomationInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const valid = validateAutomation(body);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.errors.join(". "), errors: valid.errors }, { status: 400 });
  }

  const created = await createAutomation(valid.data);
  return NextResponse.json(created, { status: 201 });
}
