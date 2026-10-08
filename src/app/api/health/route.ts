import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { APP_VERSION, BUILD_COMMIT } from "@/lib/version";
import { envFaltantes } from "@/lib/env";
import { erroresConfig } from "@/lib/config";
import { modoLocal } from "@/lib/modo-local";
import { correoDeAccesoActivo } from "@/lib/auth-correo";

export const dynamic = "force-dynamic";

/**
 * Health check publico (sin sesion). Lo usan el HEALTHCHECK del contenedor, Coolify,
 * y `scripts/verificar-instancia.mjs`.
 *
 *   200 {"ok":true,"version":"1.0.0","commit":"abc1234","db":"ok","correo":false}
 *   503 {"ok":false,"error":"db_unavailable" | "env_invalida","faltan":[...]}
 *
 * Nunca expone valores de variables, solo nombres de las que faltan.
 */
export async function GET() {
  const faltan = envFaltantes();
  if (faltan.length > 0) {
    return NextResponse.json(
      { ok: false, version: APP_VERSION, commit: BUILD_COMMIT, error: "env_invalida", faltan },
      { status: 503 }
    );
  }

  const problemas = erroresConfig();
  if (problemas.length > 0) {
    return NextResponse.json(
      { ok: false, version: APP_VERSION, commit: BUILD_COMMIT, error: "config_invalida", detalle: problemas },
      { status: 503 }
    );
  }

  try {
    const { db } = await import("@/db");
    await db.execute(sql`select 1`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[health] base no disponible:", message);
    return NextResponse.json(
      { ok: false, version: APP_VERSION, commit: BUILD_COMMIT, error: "db_unavailable" },
      { status: 503 }
    );
  }

  // `correo` es una capacidad, no un secreto: lo usa `verificar-instancia.mjs` para
  // decir si esta instancia puede invitar por correo o reparte contrasenas a mano.
  return NextResponse.json({
    ok: true,
    version: APP_VERSION,
    commit: BUILD_COMMIT,
    db: "ok",
    correo: correoDeAccesoActivo(),
    // Para que nadie confunda una instancia de verdad con alguien probandolo en su PC.
    modoLocal: modoLocal(),
  });
}
