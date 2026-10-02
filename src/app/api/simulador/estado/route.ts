import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pipelineStages, pipelines } from "@/db/schema";
import { camposContacto, getConfig } from "@/lib/config";
import { manifiestosActivos } from "@/lib/modules/cliente";
import { hasOpenRouterKey, getAgentModel } from "@/lib/agent/openrouter";
import { APP_VERSION } from "@/lib/version";
import { autorizarSimulador } from "@/lib/simulador";

export const dynamic = "force-dynamic";

/**
 * Estado de la instancia para la autoverificacion (scripts/verificar-instancia.mjs):
 * marca, etapas reales del pipeline por defecto, campos configurados, modulos
 * activos y si el agente esta configurado. Admin con sesion o AGENT_WORKER_SECRET.
 */
export async function GET(request: NextRequest) {
  const auth = await autorizarSimulador(request);
  if ("response" in auth) return auth.response;

  const { marca, pipeline: pipelineConfig } = getConfig();
  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.isDefault, true)).limit(1);
  const etapas = pipeline
    ? await db
        .select({ clave: pipelineStages.key, nombre: pipelineStages.name, ganada: pipelineStages.isWon, perdida: pipelineStages.isLost })
        .from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, pipeline.id))
        .orderBy(asc(pipelineStages.order))
    : [];

  return NextResponse.json({
    version: APP_VERSION,
    marca: { nombre: marca.nombre, nombreCorto: marca.nombreCorto },
    pipeline: { nombre: pipeline?.name ?? pipelineConfig.nombre, sincronizado: Boolean(pipeline) },
    etapas,
    campos: camposContacto().map((c) => ({ clave: c.clave, etiqueta: c.etiqueta, tipo: c.tipo })),
    modulos: manifiestosActivos().map((m) => m.nombre),
    agente: { configurado: hasOpenRouterKey(), modelo: getAgentModel() },
  });
}
