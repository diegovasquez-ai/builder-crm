"use client";

import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface Tarea {
  id: string;
  titulo: string;
  hecha: boolean;
  creadaEn: string;
}

const API = "/api/m/ejemplo";

export function Tareas({ inicial }: { inicial: Tarea[] }) {
  const [tareas, setTareas] = useState<Tarea[]>(inicial);
  const [titulo, setTitulo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function llamar(url: string, init?: RequestInit) {
    setOcupado(true);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Error");
      setTareas((await res.json()) as Tarea[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setOcupado(false);
    }
  }

  const crear = async () => {
    const t = titulo.trim();
    if (!t) return;
    await llamar(API, { method: "POST", body: JSON.stringify({ titulo: t }) });
    setTitulo("");
  };

  return (
    <div>
      <PageHeader title="Tareas" subtitle="Modulo de ejemplo: lista personal por miembro" />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Mis tareas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void crear()}
              placeholder="Nueva tarea"
              disabled={ocupado}
            />
            <Button onClick={crear} disabled={ocupado || !titulo.trim()} className="cursor-pointer">
              <Plus className="h-4 w-4" />
              Agregar
            </Button>
          </div>
          {tareas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tareas todavia.</p>
          ) : (
            <ul className="space-y-1.5">
              {tareas.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <button
                    type="button"
                    onClick={() => llamar(`${API}/${t.id}`, { method: "PATCH" })}
                    className={cn(
                      "h-5 w-5 rounded border flex items-center justify-center cursor-pointer",
                      t.hecha ? "bg-primary border-primary text-primary-foreground" : "border-border"
                    )}
                    aria-label={t.hecha ? "Marcar pendiente" : "Marcar hecha"}
                  >
                    {t.hecha && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <span className={cn("flex-1 text-sm", t.hecha && "line-through text-muted-foreground")}>{t.titulo}</span>
                  <button
                    type="button"
                    onClick={() => llamar(`${API}/${t.id}`, { method: "DELETE" })}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive cursor-pointer"
                    aria-label="Borrar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
