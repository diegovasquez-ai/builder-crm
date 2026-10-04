import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { sql } from "drizzle-orm";
import { requireAdmin, requireMember } from "@/lib/api-auth";
import { listMembers } from "@/lib/team";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Lista del equipo. La ve cualquier miembro (para el selector de propietario). */
export async function GET() {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await listMembers());
}

/**
 * Alta de un miembro (solo admin). Crea el usuario en Supabase Auth con la contrasena
 * que elige el admin y lo agrega al equipo. No pasa por el signup publico, que esta
 * cerrado.
 *
 * Si el email ya tiene usuario en Auth (se registro antes), se reutiliza ese usuario.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  let body: { email?: string; name?: string; role?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const role = body.role === "admin" ? "admin" : "asesor";
  const password = body.password ?? "";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }

  // Usuario de Auth existente?
  const [existing] = await db.execute<{ id: string }>(
    sql`select id from auth.users where lower(email) = ${email} limit 1`
  );

  let userId = existing?.id ?? null;

  if (!userId) {
    // La contrasena es opcional: si el equipo entra con un proveedor externo (Google y
    // companeros), inventar una temporal solo agrega algo que nadie va a usar. Sin
    // contrasena la cuenta existe y entra por el proveedor; con contrasena, por las dos.
    if (password && password.length < 8) {
      return NextResponse.json(
        { error: "La contrasena temporal debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: { full_name: name || null },
    });
    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message ?? "No se pudo crear el usuario" },
        { status: 502 }
      );
    }
    userId = data.user.id;
  }

  const [row] = await db
    .insert(teamMembers)
    .values({ id: userId, email, name: name || null, role, active: true })
    .onConflictDoUpdate({
      target: teamMembers.id,
      set: { name: name || null, role, active: true, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json(
    { ...row, reusedAuthUser: Boolean(existing) },
    { status: 201 }
  );
}
