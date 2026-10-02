import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireMember } from "@/lib/api-auth";
import {
  deleteAutomation,
  getAutomation,
  setAutomationEnabled,
  updateAutomation,
  validateAutomation,
  type AutomationInput,
} from "@/lib/automations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const { key } = await params;
  const rule = await getAutomation(key);
  if (!rule) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
  return NextResponse.json(rule);
}

/** Editar la regla completa (solo admin). */
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { key } = await params;

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

  const updated = await updateAutomation(key, valid.data);
  if (!updated) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
  return NextResponse.json(updated);
}

/** Prender o apagar (solo admin). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { key } = await params;

  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Falta enabled" }, { status: 400 });
  }

  const ok = await setAutomationEnabled(key, body.enabled);
  if (!ok) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
  return NextResponse.json({ key, enabled: body.enabled });
}

/** Borrar (solo admin). Las sembradas no se borran: se apagan. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { key } = await params;

  const result = await deleteAutomation(key);
  if (result === "not_found") {
    return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
  }
  if (result === "seed") {
    return NextResponse.json(
      { error: "Esta regla viene de ejemplo y no se borra. Puedes apagarla." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
