"use client";

import {
  ArrowDown,
  ArrowUp,
  Bell,
  FileText,
  MoreHorizontal,
  Tag,
  Trash2,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CatalogAction, RuleAction } from "./types";

/** Color e icono por tipo de accion: la cadena se lee de un vistazo. */
export const ACTION_STYLE: Record<string, { icon: typeof Bell; bg: string; fg: string; ring: string }> = {
  push: { icon: Bell, bg: "bg-primary/10", fg: "text-primary", ring: "ring-primary/20" },
  add_tag: { icon: Tag, bg: "bg-amber-500/10", fg: "text-amber-700", ring: "ring-amber-500/20" },
  remove_tag: { icon: Tag, bg: "bg-zinc-500/10", fg: "text-zinc-600", ring: "ring-zinc-500/20" },
  assign_owner: { icon: UserCircle2, bg: "bg-indigo-500/10", fg: "text-indigo-700", ring: "ring-indigo-500/20" },
  create_activity: { icon: FileText, bg: "bg-sky-500/10", fg: "text-sky-700", ring: "ring-sky-500/20" },
};

interface Props {
  index: number;
  total: number;
  action: RuleAction;
  def: CatalogAction | undefined;
  placeholders: string[];
  readOnly: boolean;
  onChange: (params: Record<string, string>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}

/** Una accion del flujo: su formulario de parametros y el menu de subir/bajar/eliminar. */
export function ActionCard({
  index,
  total,
  action,
  def,
  placeholders,
  readOnly,
  onChange,
  onMove,
  onRemove,
}: Props) {
  const style = ACTION_STYLE[action.type] ?? ACTION_STYLE.push;
  const Icon = style.icon;

  const setParam = (key: string, value: string) =>
    onChange({ ...action.params, [key]: value });

  const insertPlaceholder = (key: string, ph: string) => {
    const current = action.params[key] ?? "";
    setParam(key, `${current}${current && !current.endsWith(" ") ? " " : ""}{{${ph}}}`);
  };

  const selects = def?.params.filter((p) => p.type === "select") ?? [];
  const texts = def?.params.filter((p) => p.type !== "select") ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(10,22,40,0.04),0_8px_24px_-12px_rgba(10,22,40,0.18)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/70">
        <span className="h-6 w-6 rounded-full bg-foreground text-background text-[11px] font-semibold flex items-center justify-center shrink-0 font-mono">
          {index + 1}
        </span>
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ring-1", style.bg, style.fg, style.ring)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
            Accion
          </p>
          <p className="text-sm font-semibold font-heading truncate">{def?.label ?? action.type}</p>
        </div>
        {!readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer" aria-label="Opciones" />}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={index === 0} onClick={() => onMove(-1)}>
                <ArrowUp className="h-4 w-4 mr-2" /> Subir
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === total - 1} onClick={() => onMove(1)}>
                <ArrowDown className="h-4 w-4 mr-2" /> Bajar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRemove} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {def && (
        <div className="px-4 py-4 space-y-4">
          {def.description && (
            <p className="text-[13px] text-muted-foreground leading-relaxed -mt-1">{def.description}</p>
          )}

          {selects.length > 0 && (
            <div className={cn("grid gap-3", selects.length > 1 ? "sm:grid-cols-2" : "grid-cols-1")}>
              {selects.map((p) => (
                <div key={p.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {p.label}
                    {p.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Select
                    value={action.params[p.key] ?? ""}
                    items={p.options ?? []}
                    disabled={readOnly}
                    onValueChange={(v) => v && setParam(p.key, v)}
                  >
                    <SelectTrigger className="h-9 w-full cursor-pointer bg-muted/30">
                      <SelectValue placeholder="Elige…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(p.options ?? []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          {texts.map((p) => (
            <div key={p.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {p.label}
                {p.required && <span className="text-destructive"> *</span>}
              </Label>
              {p.type === "textarea" ? (
                <Textarea
                  value={action.params[p.key] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => setParam(p.key, e.target.value)}
                  placeholder={p.placeholder ?? undefined}
                  rows={2}
                  className="bg-muted/30 text-base sm:text-sm"
                />
              ) : (
                <Input
                  value={action.params[p.key] ?? ""}
                  disabled={readOnly}
                  onChange={(e) => setParam(p.key, e.target.value)}
                  placeholder={p.placeholder ?? undefined}
                  className="h-9 bg-muted/30 text-base sm:text-sm"
                />
              )}
              {p.templated && !readOnly && placeholders.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-muted-foreground mr-1">Insertar:</span>
                  {placeholders.map((ph) => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => insertPlaceholder(p.key, ph)}
                      className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[10.5px] font-mono text-foreground/80 hover:border-primary hover:text-primary cursor-pointer transition-colors"
                    >
                      {ph}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
