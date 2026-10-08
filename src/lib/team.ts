import "server-only";
import { db } from "@/db";
import { contacts, teamMembers } from "@/db/schema";
import { asc, eq, type SQL } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ID_MIEMBRO_LOCAL, modoLocal } from "@/lib/modo-local";

/**
 * Equipo y visibilidad.
 *
 * Supabase Auth dice QUIEN entro; `team_members` dice QUE ES (admin o asesor) y si
 * sigue activo. Toda ruta que devuelva contactos, conversaciones, operaciones o
 * actividades pasa por `getCurrentMember()` y aplica `ownerFilter()`:
 *
 *   admin   -> ve todo, asigna, administra el equipo
 *   asesor  -> ve solo los contactos que tiene asignados (y lo que cuelga de ellos)
 *
 * El filtro se aplica en el servidor, no en la UI: un asesor que arme la URL a mano
 * tampoco ve lo ajeno.
 */

export type TeamRole = "admin" | "asesor";

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: TeamRole;
  active: boolean;
}

function toMember(row: typeof teamMembers.$inferSelect): TeamMember {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "admin" ? "admin" : "asesor",
    active: row.active,
  };
}

/**
 * Miembro del equipo de la sesion actual, o null si no hay sesion, si el usuario
 * no esta en `team_members` o si fue desactivado.
 *
 * Un usuario de Auth que no este en el equipo no es un error de programacion: es
 * alguien que quedo fuera (desactivado, o se colo por un signup abierto). Se lo
 * trata como no autorizado.
 */
export async function getCurrentMember(): Promise<TeamMember | null> {
  // Modo local: no hay sesion que leer. El administrador de mentira lo crea
  // `npm run local` por el mismo camino que el primer admin de una instancia real (el
  // disparador sobre auth.users), asi que se lee de la base como cualquier otro.
  if (modoLocal()) {
    const [row] = await db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.id, ID_MIEMBRO_LOCAL))
      .limit(1);
    return row ? toMember(row) : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [row] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, user.id))
    .limit(1);

  if (!row || !row.active) return null;
  return toMember(row);
}

export async function listMembers(opts?: {
  onlyActive?: boolean;
}): Promise<TeamMember[]> {
  const rows = await db.select().from(teamMembers).orderBy(asc(teamMembers.createdAt));
  return rows
    .filter((r) => !opts?.onlyActive || r.active)
    .map(toMember);
}

export async function getMember(id: string): Promise<TeamMember | null> {
  const [row] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, id))
    .limit(1);
  return row ? toMember(row) : null;
}

/**
 * Condicion SQL de visibilidad sobre `contacts`. `undefined` = sin filtro (admin).
 * Para tablas que cuelgan del contacto (conversaciones, operaciones, actividades) se
 * hace join a `contacts` y se aplica la misma condicion.
 */
export function ownerFilter(member: TeamMember): SQL | undefined {
  if (member.role === "admin") return undefined;
  return eq(contacts.ownerId, member.id);
}

/**
 * Para `listConversations({ ownerId })` y similares: `undefined` = sin filtro.
 */
export function visibleOwnerId(member: TeamMember): string | undefined {
  return member.role === "admin" ? undefined : member.id;
}

/** true si el miembro puede ver/tocar este contacto. */
export function canAccessContact(
  member: TeamMember,
  contact: { ownerId: string | null }
): boolean {
  return member.role === "admin" || contact.ownerId === member.id;
}

/**
 * Como `canAccessContact`, pero a partir del id: consulta `owner_id`. Para rutas por
 * id (operacion, actividad, hilo) que solo tienen el contact_id a mano. Un contacto
 * inexistente devuelve false, y la ruta responde 404 sin confirmar que exista.
 */
export async function canAccessContactId(
  member: TeamMember,
  contactId: string
): Promise<boolean> {
  if (member.role === "admin") return true;
  const [row] = await db
    .select({ ownerId: contacts.ownerId })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  return Boolean(row) && row.ownerId === member.id;
}

/** true si ya hay al menos un miembro: decide si el registro publico sigue abierto. */
export async function hayMiembros(): Promise<boolean> {
  const [row] = await db.select({ id: teamMembers.id }).from(teamMembers).limit(1);
  return Boolean(row);
}

/**
 * Busca un asesor activo por nombre o email, tolerante a mayusculas, acentos y
 * nombres parciales ("juan" matchea "Juan Perez"). Lo usa el agente: el prompt dice
 * "asignaselo a Juan" y aca se resuelve a quien es Juan.
 *
 * Devuelve `ambiguous` cuando mas de uno matchea, para que el agente pregunte en vez
 * de adivinar.
 */
export async function findMemberByName(
  query: string
): Promise<
  | { status: "found"; member: TeamMember }
  | { status: "ambiguous"; candidates: TeamMember[] }
  | { status: "not_found"; available: TeamMember[] }
> {
  const members = await listMembers({ onlyActive: true });
  const q = normalize(query);
  if (!q) return { status: "not_found", available: members };

  const exact = members.filter(
    (m) => normalize(m.name ?? "") === q || normalize(m.email) === q
  );
  if (exact.length === 1) return { status: "found", member: exact[0] };

  const partial = members.filter((m) => {
    const name = normalize(m.name ?? "");
    const emailUser = normalize(m.email.split("@")[0]);
    return (
      name.includes(q) ||
      (q.includes(name) && name.length > 2) ||
      emailUser === q ||
      name.split(" ").some((part) => part === q)
    );
  });

  if (partial.length === 1) return { status: "found", member: partial[0] };
  if (partial.length > 1) return { status: "ambiguous", candidates: partial };
  return { status: "not_found", available: members };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function displayName(member: Pick<TeamMember, "name" | "email">): string {
  return member.name?.trim() || member.email.split("@")[0];
}
