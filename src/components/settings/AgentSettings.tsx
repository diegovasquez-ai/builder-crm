"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, RotateCcw, Save, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CHANNELS, CHANNEL_LABELS, type Channel } from "@/lib/channels/types";
import { CHANNEL_COLORS, ChannelIcon } from "@/components/icons/channels";

type Scope = "global" | Channel;

interface ToolMeta {
  name: string;
  description: string;
}

interface AgentConfig {
  systemPrompt: string;
  enabledTools: string[];
  allTools: ToolMeta[];
  /** Solo en scope de canal: si el agente contesta o no en esa red. */
  enabled?: boolean;
  /** Solo en scope de canal: que campos vienen del global en vez de ser propios. */
  inherited?: { systemPrompt: boolean; enabledTools: boolean; model: boolean };
  defaults: {
    systemPrompt: string;
    enabledTools: string[];
  };
}

export function AgentSettings() {
  const [scope, setScope] = useState<Scope>("global");
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingTools, setSavingTools] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);

  const endpoint =
    scope === "global"
      ? "/api/settings/agent"
      : `/api/settings/agent?channel=${scope}`;

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    fetch(endpoint, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: AgentConfig) => {
        if (cancelled) return;
        setConfig(data);
        setSystemPrompt(data.systemPrompt);
        setEnabledTools(data.enabledTools);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("No se pudo cargar la configuracion del agente");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const toggleEnabled = async () => {
    if (!config || scope === "global") return;
    const next = !config.enabled;
    setTogglingEnabled(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("toggle_failed");
      setConfig((prev) => (prev ? { ...prev, enabled: next } : prev));
      toast.success(
        next
          ? `Agente activado en ${CHANNEL_LABELS[scope]}`
          : `Agente desactivado en ${CHANNEL_LABELS[scope]}`
      );
    } catch {
      toast.error("No se pudo cambiar el estado del agente");
    } finally {
      setTogglingEnabled(false);
    }
  };

  const promptDirty =
    config !== null && systemPrompt.trim() !== config.systemPrompt.trim();

  const isUsingDefaultPrompt =
    config !== null &&
    systemPrompt.trim() === config.defaults.systemPrompt.trim();

  const savePrompt = async () => {
    if (!promptDirty) return;
    setSavingPrompt(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "save_failed");
      }
      const updated = await res.json();
      setConfig((prev) =>
        prev ? { ...prev, systemPrompt: updated.systemPrompt } : prev
      );
      setSystemPrompt(updated.systemPrompt);
      toast.success("System prompt guardado");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error guardando el prompt"
      );
    } finally {
      setSavingPrompt(false);
    }
  };

  const restoreDefaultPrompt = () => {
    if (!config) return;
    if (
      !confirm(
        "Restaurar el system prompt al default? Vas a perder los cambios guardados."
      )
    ) {
      return;
    }
    setSystemPrompt(config.defaults.systemPrompt);
    toast.message(
      "Prompt restaurado al default. Pulsa Guardar para confirmar el cambio."
    );
  };

  const toggleTool = async (toolName: string) => {
    if (!config) return;
    const next = enabledTools.includes(toolName)
      ? enabledTools.filter((t) => t !== toolName)
      : [...enabledTools, toolName];

    if (next.length === 0) {
      if (
        !confirm(
          "Vas a dejar al agente sin ninguna herramienta. Solo va a responder con texto. Continuar?"
        )
      ) {
        return;
      }
    }

    const previous = enabledTools;
    setEnabledTools(next);
    setSavingTools(true);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledTools: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "save_failed");
      }
      toast.success(
        next.includes(toolName)
          ? `Herramienta "${toolName}" activada`
          : `Herramienta "${toolName}" desactivada`
      );
    } catch (err) {
      setEnabledTools(previous);
      toast.error(
        err instanceof Error ? err.message : "No se pudo actualizar la tool"
      );
    } finally {
      setSavingTools(false);
    }
  };

  const resetAll = async () => {
    if (
      !confirm(
        "Borrar TODA la configuracion personalizada del agente y volver a defaults? (Prompt + tools)"
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) throw new Error("reset_failed");
      const data = await res.json();
      setSystemPrompt(data.systemPrompt);
      setEnabledTools(data.enabledTools);
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              systemPrompt: data.systemPrompt,
              enabledTools: data.enabledTools,
            }
          : prev
      );
      toast.success("Configuracion del agente restaurada a defaults");
    } catch {
      toast.error("Error restaurando defaults");
    } finally {
      setResetting(false);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando configuracion del agente...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scope: global o por canal. "los agentes no deben ser iguales": cada red puede
          tener su propio prompt y sus propias tools, heredando del global si no. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setScope("global")}
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer",
            scope === "global"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <Bot className="h-3 w-3" />
          Global
        </button>
        {CHANNELS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setScope(c)}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer",
              scope === c
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <ChannelIcon
              channel={c}
              className={cn("h-3 w-3", scope === c ? "" : CHANNEL_COLORS[c])}
            />
            {CHANNEL_LABELS[c]}
          </button>
        ))}
      </div>

      {scope !== "global" && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">
              Agente en {CHANNEL_LABELS[scope]}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {config.inherited?.systemPrompt
                ? "Este canal hereda el prompt global. Editalo y guarda para darle uno propio."
                : "Este canal tiene prompt propio."}
            </p>
          </div>
          <Button
            size="sm"
            variant={config.enabled ? "secondary" : "default"}
            onClick={toggleEnabled}
            disabled={togglingEnabled}
          >
            {togglingEnabled && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {config.enabled ? "Desactivar" : "Activar"}
          </Button>
        </div>
      )}

      {/* System prompt */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4" />
              System prompt
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define rol, reglas y estilo del agente. Usa{" "}
              <code className="bg-muted px-1 rounded">{"{{fecha}}"}</code> para
              insertar la fecha de hoy en formato es-AR.
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 inline-flex items-center h-5 px-2 rounded-sm text-[10px] font-semibold uppercase tracking-wide",
              isUsingDefaultPrompt
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary border border-primary/20"
            )}
          >
            {isUsingDefaultPrompt ? "Default" : "Personalizado"}
          </span>
        </div>

        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={20}
          className="font-mono text-xs resize-y"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          data-lt-active="false"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {systemPrompt.length} caracteres
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={restoreDefaultPrompt}
              disabled={savingPrompt || isUsingDefaultPrompt}
              className="cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Restaurar default
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={savePrompt}
              disabled={!promptDirty || savingPrompt}
              className="cursor-pointer"
            >
              {savingPrompt ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              Guardar prompt
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Tools toggle */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Herramientas
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Activa o desactiva las herramientas que el agente puede llamar. Las
            desactivadas no se le exponen al modelo.
          </p>
        </div>

        <div className="space-y-2">
          {config.allTools.map((tool) => {
            const isOn = enabledTools.includes(tool.name);
            return (
              <div
                key={tool.name}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card"
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  disabled={savingTools}
                  onClick={() => toggleTool(tool.name)}
                  className={cn(
                    "mt-0.5 shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
                    isOn ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      isOn ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-mono font-medium">
                    {tool.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tool.description}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 inline-flex items-center h-5 px-1.5 rounded-sm text-[10px] font-semibold uppercase tracking-wide",
                    isOn
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isOn ? "ON" : "OFF"}
                </span>
              </div>
            );
          })}
        </div>

        {enabledTools.length === 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
            ⚠ No hay herramientas activas. El agente solo va a poder responder
            con texto, no va a poder buscar propiedades, agendar visitas ni
            derivar.
          </p>
        )}
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Para volver a la configuracion de fabrica del agente.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetAll}
          disabled={resetting}
          className="cursor-pointer text-destructive hover:text-destructive"
        >
          {resetting ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          )}
          Restaurar todo a defaults
        </Button>
      </div>
    </div>
  );
}
