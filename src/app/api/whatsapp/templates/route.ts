import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { whatsappTemplates } from "@/db/schema";
import { getPrimaryAccount } from "@/lib/whatsapp-accounts";
import {
  createTemplate,
  getTemplates,
  type MetaTemplate,
} from "@/lib/meta-whatsapp";
import {
  buildBodyComponent,
  extractVariables,
  variablesAreSequential,
} from "@/lib/whatsapp-templates";
import { getAccountForChannel } from "@/lib/channels/accounts";
import { whatsappProvider } from "@/lib/channels/provider";
import { resolveDefaultTenantId } from "@/lib/tenants";
import {
  createTemplate as createZernioTemplate,
  listTemplates as listZernioTemplates,
} from "@/lib/zernio/whatsapp";
import { requireMember } from "@/lib/api-auth";

/**
 * Las plantillas viven en la WABA, no en el proveedor: Zernio expone
 * `/v1/whatsapp/templates` con la misma forma que Graph API (name, language, category,
 * components, status), asi que el resto del archivo y la tabla local no cambian.
 * Con `WHATSAPP_PROVIDER=meta` se sigue hablando con Graph directo.
 */
async function fetchRemoteTemplates(): Promise<{
  templates?: MetaTemplate[];
  error?: string;
}> {
  if (whatsappProvider() === "meta") {
    const account = await getPrimaryAccount();
    const remote = await getTemplates(account);
    return remote.success
      ? { templates: remote.templates as MetaTemplate[] }
      : { error: remote.error?.message || "No se pudo sincronizar con Meta" };
  }

  const tenantId = await resolveDefaultTenantId();
  const account = await getAccountForChannel(tenantId, "whatsapp");
  if (!account?.zernioAccountId) {
    return { error: "No hay cuenta de WhatsApp conectada en Zernio" };
  }
  const remote = await listZernioTemplates(account.zernioAccountId);
  return remote.success
    ? { templates: (remote.data.templates ?? []) as unknown as MetaTemplate[] }
    : { error: remote.error.message };
}

async function createRemoteTemplate(input: {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  components: unknown[];
}): Promise<{
  success: boolean;
  templateId?: string | null;
  status?: string;
  error?: { code?: number; message?: string };
}> {
  if (whatsappProvider() === "meta") {
    const account = await getPrimaryAccount();
    const result = await createTemplate(account, input);
    return {
      success: result.success,
      templateId: result.templateId ?? null,
      status: result.status,
      error: result.error,
    };
  }

  const tenantId = await resolveDefaultTenantId();
  const account = await getAccountForChannel(tenantId, "whatsapp");
  if (!account?.zernioAccountId) {
    return {
      success: false,
      error: { message: "No hay cuenta de WhatsApp conectada en Zernio" },
    };
  }

  const result = await createZernioTemplate({
    accountId: account.zernioAccountId,
    name: input.name,
    language: input.language,
    category: input.category,
    components: input.components,
  });

  return result.success
    ? {
        success: true,
        templateId: result.data.id ?? null,
        status: result.data.status ?? "PENDING",
      }
    : { success: false, error: { message: result.error.message } };
}

type TemplateValues = typeof whatsappTemplates.$inferInsert;

function listLocal() {
  return db
    .select()
    .from(whatsappTemplates)
    .orderBy(desc(whatsappTemplates.updatedAt));
}

/** Inserta o actualiza por (name, language) y devuelve la fila resultante. */
async function upsertTemplate(values: TemplateValues) {
  const [existing] = await db
    .select()
    .from(whatsappTemplates)
    .where(
      and(
        eq(whatsappTemplates.name, values.name),
        eq(whatsappTemplates.language, values.language ?? "es")
      )
    )
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(whatsappTemplates)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(whatsappTemplates.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db.insert(whatsappTemplates).values(values).returning();
  return row;
}

/** GET /api/whatsapp/templates?sync=1 — lista local; con sync trae estado de Meta. */
export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const sync = request.nextUrl.searchParams.get("sync") === "1";
  let syncError: string | undefined;

  if (sync) {
    const remote = await fetchRemoteTemplates();
    if (remote.templates) {
      for (const t of remote.templates) {
        await upsertTemplate({
          name: t.name,
          language: t.language || "es",
          category: t.category || "UTILITY",
          components: t.components ?? [],
          status: t.status || "PENDING",
          metaTemplateId: t.id || null,
        });
      }
    } else {
      syncError = remote.error || "No se pudo sincronizar las plantillas";
    }
  }

  const templates = await listLocal();
  return NextResponse.json({ templates, ...(syncError ? { syncError } : {}) });
}

const createSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(
      /^[a-z0-9_]+$/,
      "El nombre solo admite minusculas, numeros y guion bajo (ej: recordatorio_visita)"
    ),
  category: z.enum(["MARKETING", "UTILITY"]),
  language: z.string().min(2).max(10).default("es"),
  bodyText: z.string().min(1, "El cuerpo no puede estar vacio").max(1024),
  examples: z.array(z.string()).default([]),
});

/** POST /api/whatsapp/templates — crea la plantilla en Meta y la guarda local. */
export async function POST(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Datos invalidos" },
      { status: 400 }
    );
  }
  const { name, category, language, bodyText, examples } = parsed.data;

  const vars = extractVariables(bodyText);
  if (!variablesAreSequential(vars)) {
    return NextResponse.json(
      {
        error:
          "Las variables deben ser secuenciales empezando en {{1}} (sin huecos ni saltos).",
      },
      { status: 400 }
    );
  }
  const filledExamples = examples.map((e) => e.trim());
  if (vars.length > 0 && filledExamples.filter(Boolean).length < vars.length) {
    return NextResponse.json(
      { error: `Hay ${vars.length} variable(s): da un ejemplo para cada una.` },
      { status: 400 }
    );
  }

  const components = [buildBodyComponent(bodyText, filledExamples)];
  const result = await createRemoteTemplate({
    name,
    language,
    category,
    components,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        hint: getTemplateHint(result.error?.code, result.error?.message),
      },
      { status: 502 }
    );
  }

  const row = await upsertTemplate({
    name,
    language,
    category,
    components,
    status: result.status || "PENDING",
    metaTemplateId: result.templateId || null,
  });

  return NextResponse.json({ success: true, template: row });
}

function getTemplateHint(code?: number, message?: string): string | undefined {
  if (message && /already exists/i.test(message)) {
    return "Ya existe una plantilla con ese nombre e idioma. Usa otro nombre o sincroniza para verla.";
  }
  const hints: Record<number, string> = {
    100: "Algun parametro es invalido. Revisa el nombre (minusculas/guion bajo) y que cada variable tenga ejemplo.",
    190: "El token de acceso vencio o no tiene permisos de whatsapp_business_management.",
  };
  return code ? hints[code] : undefined;
}
