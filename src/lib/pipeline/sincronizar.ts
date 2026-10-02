import "server-only";
import { db } from "@/db";
import { pipelines, pipelineStages, deals } from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getConfig } from "@/lib/config";

/**
 * Lleva el pipeline por defecto al estado que describe config/cliente.ts.
 *
 * Corre al arrancar (instrumentation.ts) y es idempotente:
 *  - Si no hay pipeline por defecto, lo crea con el nombre de la config.
 *  - Cada etapa de la config se busca por `key`; si no tiene key todavia, por nombre
 *    (para adoptar las etapas que ya existian antes de la config); si no existe, se crea.
 *  - Nombre, color, orden y ganada/perdida se actualizan desde la config.
 *  - Las etapas que estan en la base pero NO en la config se conservan (pueden tener
 *    operaciones) y se ordenan despues; se borran solo si no tienen operaciones y
 *    `borrarSobrantes` es true (no es el default).
 *
 * La UI sigue pudiendo crear etapas a mano; esas quedan sin key y sobreviven.
 */
export async function sincronizarPipeline(opts?: { borrarSobrantes?: boolean }) {
  const { pipeline } = getConfig();

  let [principal] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.isDefault, true))
    .limit(1);

  if (!principal) {
    [principal] = await db
      .insert(pipelines)
      .values({ name: pipeline.nombre, isDefault: true, order: 0 })
      .returning();
  } else if (principal.name !== pipeline.nombre) {
    await db
      .update(pipelines)
      .set({ name: pipeline.nombre, updatedAt: new Date() })
      .where(eq(pipelines.id, principal.id));
  }

  const existentes = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, principal.id))
    .orderBy(asc(pipelineStages.order));

  const porClave = new Map(existentes.filter((e) => e.key).map((e) => [e.key as string, e]));
  const sinClave = existentes.filter((e) => !e.key);
  const usadas = new Set<string>();
  let creadas = 0;
  let actualizadas = 0;

  for (let i = 0; i < pipeline.etapas.length; i++) {
    const etapa = pipeline.etapas[i];
    let fila = porClave.get(etapa.clave);
    if (!fila) {
      const idx = sinClave.findIndex(
        (e) => e.name.trim().toLowerCase() === etapa.nombre.trim().toLowerCase()
      );
      if (idx >= 0) fila = sinClave.splice(idx, 1)[0];
    }

    const valores = {
      key: etapa.clave,
      name: etapa.nombre,
      color: etapa.color,
      order: i,
      isWon: etapa.ganada,
      isLost: etapa.perdida,
    };

    if (fila) {
      usadas.add(fila.id);
      const cambio =
        fila.key !== valores.key ||
        fila.name !== valores.name ||
        fila.color !== valores.color ||
        fila.order !== valores.order ||
        fila.isWon !== valores.isWon ||
        fila.isLost !== valores.isLost;
      if (cambio) {
        await db.update(pipelineStages).set(valores).where(eq(pipelineStages.id, fila.id));
        actualizadas++;
      }
    } else {
      await db.insert(pipelineStages).values({ pipelineId: principal.id, ...valores });
      creadas++;
    }
  }

  // Sobrantes: lo que esta en la base y no en la config.
  const sobrantes = existentes.filter((e) => !usadas.has(e.id));
  let conservadas = 0;
  let borradas = 0;
  for (let j = 0; j < sobrantes.length; j++) {
    const s = sobrantes[j];
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(deals)
      .where(eq(deals.stageId, s.id));
    if (opts?.borrarSobrantes && n === 0) {
      await db.delete(pipelineStages).where(eq(pipelineStages.id, s.id));
      borradas++;
    } else {
      const orden = pipeline.etapas.length + j;
      if (s.order !== orden) {
        await db.update(pipelineStages).set({ order: orden }).where(eq(pipelineStages.id, s.id));
      }
      conservadas++;
    }
  }

  // Los demas pipelines no son el default.
  if (existentes.length === 0 && creadas > 0) {
    await db
      .update(pipelines)
      .set({ isDefault: false })
      .where(and(eq(pipelines.isDefault, true), inArray(pipelines.id, [principal.id])))
      .then(() => db.update(pipelines).set({ isDefault: true }).where(eq(pipelines.id, principal.id)));
  }

  return { pipelineId: principal.id, creadas, actualizadas, conservadas, borradas };
}
