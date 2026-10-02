import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Editar nombre, rol o estado de un miembro (solo admin). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  let body: { name?: string; role?: string; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const [target] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, id))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }

  const update: Partial<typeof teamMembers.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) update.name = body.name.trim() || null;
  if (body.role !== undefined) update.role = body.role === "admin" ? "admin" : "asesor";
  if (body.active !== undefined) update.active = Boolean(body.active);

  // No dejar el equipo sin ningun admin activo: si esta accion baja o apaga al
  // ultimo, se rechaza.
  const quitaAdmin =
    target.role === "admin" &&
    target.active &&
    (update.role === "asesor" || update.active === false);
  if (quitaAdmin) {
    const otros = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.role, "admin"),
          eq(teamMembers.active, true),
          ne(teamMembers.id, id)
        )
      );
    if (otros.length === 0) {
      return NextResponse.json(
        { error: "Es el unico administrador activo. Nombra otro antes." },
        { status: 400 }
      );
    }
  }

  const [row] = await db
    .update(teamMembers)
    .set(update)
    .where(eq(teamMembers.id, id))
    .returning();

  return NextResponse.json(row);
}
