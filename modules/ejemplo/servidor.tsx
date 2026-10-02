import "server-only";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { ModuloServidor, HandlerModulo } from "@/lib/modules/types";
import manifiesto from "./manifiesto";
import { Tareas, type Tarea } from "./componentes/Tareas";

/**
 * Lado servidor del modulo de ejemplo: paginas, API, una tool para el agente y seed.
 * Las tablas del modulo no estan en src/db/schema.ts (es zona del cliente): se
 * consultan con SQL tipado via `sql` de drizzle.
 */

async function listar(memberId: string): Promise<Tarea[]> {
  const filas = await db.execute(sql`
    select id, titulo, hecha, created_at as "creadaEn"
    from ejemplo_tareas
    where member_id = ${memberId}
    order by hecha asc, created_at desc
  `);
  return filas as unknown as Tarea[];
}

const listarApi: HandlerModulo = async (_req, { member }) =>
  NextResponse.json(await listar(member.id));

const crear: HandlerModulo = async (req, { member }) => {
  const body = (await req.json().catch(() => null)) as { titulo?: string } | null;
  const titulo = body?.titulo?.trim();
  if (!titulo) return NextResponse.json({ error: "titulo requerido" }, { status: 400 });
  await db.execute(sql`insert into ejemplo_tareas (titulo, member_id) values (${titulo}, ${member.id})`);
  return NextResponse.json(await listar(member.id), { status: 201 });
};

const alternar: HandlerModulo = async (_req, { member, params }) => {
  await db.execute(sql`
    update ejemplo_tareas set hecha = not hecha
    where id = ${params.id}::uuid and member_id = ${member.id}
  `);
  return NextResponse.json(await listar(member.id));
};

const borrar: HandlerModulo = async (_req, { member, params }) => {
  await db.execute(sql`delete from ejemplo_tareas where id = ${params.id}::uuid and member_id = ${member.id}`);
  return NextResponse.json(await listar(member.id));
};

const modulo: ModuloServidor = {
  manifiesto,

  paginas: {
    // /m/ejemplo
    "": async ({ member }) => <Tareas inicial={await listar(member.id)} />,
  },

  api: {
    // /api/m/ejemplo
    "": { GET: listarApi, POST: crear },
    // /api/m/ejemplo/<id>
    "[id]": { PATCH: alternar, DELETE: borrar },
  },

  tools: [
    {
      definicion: {
        type: "function",
        function: {
          name: "anotar_tarea",
          description:
            "Anota una tarea pendiente para el equipo a partir de lo que pide el cliente (ej. 'enviar presupuesto el lunes').",
          parameters: {
            type: "object",
            properties: { titulo: { type: "string", description: "Que hay que hacer, en una frase" } },
            required: ["titulo"],
          },
        },
      },
      descripcionUI: "Permite al agente anotar tareas pendientes para el equipo (modulo de ejemplo).",
      async ejecutar(args) {
        const titulo = String(args.titulo ?? "").trim();
        if (!titulo) return { ok: false, error: "titulo vacio" };
        await db.execute(sql`insert into ejemplo_tareas (titulo, member_id) values (${"(agente) " + titulo}, null)`);
        return { ok: true, data: { anotada: titulo } };
      },
    },
  ],

  async seed() {
    const [{ n }] = (await db.execute(sql`select count(*)::int as n from ejemplo_tareas`)) as unknown as [{ n: number }];
    if (n > 0) return;
    await db.execute(sql`
      insert into ejemplo_tareas (titulo, member_id)
      select t.titulo, (select id from team_members order by created_at limit 1)
      from (values ('Llamar al lead de ayer'), ('Preparar propuesta')) as t(titulo)
    `);
  },
};

export default modulo;
