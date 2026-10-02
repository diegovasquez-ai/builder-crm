import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { crmSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getDefaultSystemPromptTemplate,
  getSystemPromptTemplate,
  SYSTEM_PROMPT_SETTINGS_KEY,
} from "@/lib/agent/prompt";
import {
  ENABLED_TOOLS_SETTINGS_KEY,
  descripcionesUI,
  getEnabledToolNames,
  nombresDeTools,
} from "@/lib/agent/tools";
import {
  getAgentConfig,
  resetAgentConfig,
  saveAgentConfig,
} from "@/lib/agent/config";
import { isChannel } from "@/lib/channels/types";
import { requireMember } from "@/lib/api-auth";

const MIN_PROMPT_LENGTH = 50;

/**
 * Sin `?channel=` opera sobre la config GLOBAL (`crm_settings`), que sigue siendo el
 * fallback de todos los canales. Con `?channel=instagram` opera sobre la fila de
 * `agent_configs` de ese canal, que es lo que permite tener un agente distinto por red.
 */
export async function GET(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const channel = request.nextUrl.searchParams.get("channel");

  const allTools = descripcionesUI();

  if (isChannel(channel)) {
    const config = await getAgentConfig(channel);
    return NextResponse.json({
      channel,
      enabled: config.enabled,
      systemPrompt: config.systemPrompt,
      enabledTools: config.enabledTools,
      inherited: {
        systemPrompt: config.promptInherited,
        enabledTools: config.toolsInherited,
        model: config.modelInherited,
      },
      model: config.model,
      allTools,
      defaults: {
        systemPrompt: getDefaultSystemPromptTemplate(),
        enabledTools: nombresDeTools(),
      },
    });
  }

  const [systemPrompt, enabledTools] = await Promise.all([
    getSystemPromptTemplate(),
    getEnabledToolNames(),
  ]);

  return NextResponse.json({
    channel: null,
    systemPrompt,
    enabledTools,
    allTools,
    defaults: {
      systemPrompt: getDefaultSystemPromptTemplate(),
      enabledTools: nombresDeTools(),
    },
  });
}

interface PutBody {
  systemPrompt?: string;
  enabledTools?: string[];
  enabled?: boolean;
  model?: string | null;
}

async function upsertSetting(key: string, value: string): Promise<void> {
  await db
    .insert(crmSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: crmSettings.key, set: { value } });
}

export async function PUT(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  let body: PutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    body.systemPrompt === undefined &&
    body.enabledTools === undefined &&
    body.enabled === undefined &&
    body.model === undefined
  ) {
    return NextResponse.json(
      { error: "Nada para actualizar" },
      { status: 400 }
    );
  }

  const channel = request.nextUrl.searchParams.get("channel");
  if (isChannel(channel)) {
    // Prompt vacio = volver a heredar del global, no un prompt invalido.
    const prompt = body.systemPrompt?.trim();
    if (prompt && prompt.length < MIN_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `El prompt es demasiado corto (minimo ${MIN_PROMPT_LENGTH} caracteres)` },
        { status: 400 }
      );
    }
    const saved = await saveAgentConfig(channel, {
      enabled: body.enabled,
      systemPrompt: body.systemPrompt === undefined ? undefined : prompt || null,
      enabledTools: body.enabledTools,
      model: body.model,
    });
    if (!saved) {
      return NextResponse.json(
        { error: "No existe el tenant default" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      channel,
      enabled: saved.enabled,
      systemPrompt: saved.systemPrompt,
      enabledTools: saved.enabledTools,
      inherited: {
        systemPrompt: saved.promptInherited,
        enabledTools: saved.toolsInherited,
        model: saved.modelInherited,
      },
    });
  }

  if (body.systemPrompt !== undefined) {
    const trimmed = body.systemPrompt.trim();
    if (trimmed.length < MIN_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `El prompt es demasiado corto (minimo ${MIN_PROMPT_LENGTH} caracteres)` },
        { status: 400 }
      );
    }
    await upsertSetting(SYSTEM_PROMPT_SETTINGS_KEY, trimmed);
  }

  if (body.enabledTools !== undefined) {
    if (!Array.isArray(body.enabledTools)) {
      return NextResponse.json(
        { error: "enabledTools debe ser un array" },
        { status: 400 }
      );
    }
    const validNames = new Set(nombresDeTools());
    const cleaned: string[] = [];
    for (const name of body.enabledTools) {
      if (typeof name !== "string") continue;
      if (!validNames.has(name)) continue;
      if (cleaned.includes(name)) continue;
      cleaned.push(name);
    }
    await upsertSetting(ENABLED_TOOLS_SETTINGS_KEY, JSON.stringify(cleaned));
  }

  const [systemPrompt, enabledTools] = await Promise.all([
    getSystemPromptTemplate(),
    getEnabledToolNames(),
  ]);

  return NextResponse.json({ systemPrompt, enabledTools });
}

/**
 * DELETE: limpia los overrides y vuelve a defaults.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireMember();
  if ("response" in auth) return auth.response;
  const channel = request.nextUrl.searchParams.get("channel");
  if (isChannel(channel)) {
    const reset = await resetAgentConfig(channel);
    return NextResponse.json({
      channel,
      systemPrompt: reset?.systemPrompt ?? getDefaultSystemPromptTemplate(),
      enabledTools: reset?.enabledTools ?? nombresDeTools(),
      inherited: { systemPrompt: true, enabledTools: true, model: true },
    });
  }

  await db
    .delete(crmSettings)
    .where(eq(crmSettings.key, SYSTEM_PROMPT_SETTINGS_KEY));
  await db
    .delete(crmSettings)
    .where(eq(crmSettings.key, ENABLED_TOOLS_SETTINGS_KEY));

  return NextResponse.json({
    systemPrompt: getDefaultSystemPromptTemplate(),
    enabledTools: nombresDeTools(),
  });
}
