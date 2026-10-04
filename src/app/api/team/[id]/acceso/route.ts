import { NextResponse } from "next/server";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";
import { correoDeAccesoActivo, enviarEnlaceDeAcceso } from "@/lib/auth-correo";

export const dynamic = "force-dynamic";

/**
 * Reenviar el acceso a un miembro que ya esta en el equipo (solo admin): le llega un
 * correo con un enlace para definir su contrasena.
 *
 * Es para el caso de todos los dias: perdio la contrasena, nunca abrio la invitacion, o
 * se la pasaron por un chat que ya no encuentra. No cambia nada hasta que la persona usa
 * el enlace, asi que reenviarlo dos veces no rompe nada.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  if (!correoDeAccesoActivo()) {
    return NextResponse.json(
      { error: "Esta instancia no manda correos de acceso. Ver docs/CORREO.md" },
      { status: 400 }
    );
  }

  const [miembro] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, id))
    .limit(1);
  if (!miembro) {
    return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
  }
  if (!miembro.active) {
    return NextResponse.json(
      { error: "Esta persona esta desactivada: reactivala primero" },
      { status: 409 }
    );
  }

  // Un miembro sin usuario de Auth no puede recibir nada: pasa si alguien borro el
  // usuario a mano. Mejor decirlo que mandar un correo al vacio.
  const [usuario] = await db.execute<{ id: string }>(
    sql`select id from auth.users where id = ${id} limit 1`
  );
  if (!usuario) {
    return NextResponse.json(
      { error: "Esta persona no tiene usuario de acceso: quitala del equipo y volve a invitarla" },
      { status: 409 }
    );
  }

  const { error } = await enviarEnlaceDeAcceso(miembro.email);
  if (error) {
    return NextResponse.json({ error: `No se pudo enviar: ${error}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, email: miembro.email });
}
