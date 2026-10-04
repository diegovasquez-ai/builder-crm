import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teamMembers } from "@/db/schema";
import { sql } from "drizzle-orm";
import { requireAdmin, requireMember } from "@/lib/api-auth";
import { listMembers } from "@/lib/team";
import { createAdminClient } from "@/lib/supabase/admin";
import { correoDeAccesoActivo, enviarEnlaceDeAcceso, invitarPorCorreo } from "@/lib/auth-correo";

export const dynamic = "force-dynamic";

/** Lista del equipo. La ve cualquier miembro (para el selector de propietario). */
export async function GET() {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  return NextResponse.json(await listMembers());
}

/**
 * Alta de un miembro (solo admin). Crea el usuario en Supabase Auth y lo agrega al
 * equipo. No pasa por el signup publico, que esta cerrado.
 *
 * Dos formas de darle acceso, segun `invitar`:
 *   - invitacion por correo: la persona recibe un enlace y elige su propia contrasena.
 *     Solo si la instancia declara que el servidor de autenticacion manda correos.
 *   - contrasena temporal (o ninguna, si entra con un proveedor externo): el admin se la
 *     pasa por donde quiera. Es el unico camino cuando no hay correo configurado.
 *
 * Si el email ya tiene usuario en Auth (se registro antes, o entro con Google), se
 * reutiliza ese usuario y la contrasena que venga se ignora.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  let body: { email?: string; name?: string; role?: string; password?: string; invitar?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const role = body.role === "admin" ? "admin" : "asesor";
  const password = body.password ?? "";
  // El interruptor manda sobre lo que pida el navegador: sin correo configurado, una
  // "invitacion enviada" seria mentira (ver src/lib/auth-correo.ts).
  const invitar = Boolean(body.invitar) && correoDeAccesoActivo();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Email invalido" }, { status: 400 });
  }

  // Usuario de Auth existente?
  const [existing] = await db.execute<{ id: string }>(
    sql`select id from auth.users where lower(email) = ${email} limit 1`
  );

  let userId = existing?.id ?? null;
  let correoEnviado = false;
  let avisoCorreo: string | null = null;

  if (!userId && invitar) {
    // GoTrue crea el usuario y manda el correo en la misma transaccion: si el envio
    // falla, no queda ningun usuario a medias y el error se puede mostrar tal cual.
    const r = await invitarPorCorreo(email, name);
    if ("error" in r) {
      return NextResponse.json(
        { error: `No se pudo enviar la invitacion: ${r.error}` },
        { status: 502 }
      );
    }
    userId = r.userId;
    correoEnviado = true;
  }

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

  // Usuario que ya existia y el admin pidio avisarle: no se puede invitar dos veces, se
  // le manda un enlace para definir la contrasena. Si el envio falla, el alta igual
  // vale: se avisa y el admin le pasa el acceso por otro lado.
  if (existing && invitar) {
    const { error } = await enviarEnlaceDeAcceso(email);
    if (error) avisoCorreo = error;
    else correoEnviado = true;
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
    { ...row, reusedAuthUser: Boolean(existing), correoEnviado, avisoCorreo },
    { status: 201 }
  );
}
