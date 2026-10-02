"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Boton del inicio (solo admin): carga los datos de demostracion y refresca. */
export function CargarDemo() {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  const cargar = async () => {
    if (!confirm("Cargar contactos, conversaciones y operaciones de demostracion? Son datos inventados y se pueden borrar despues.")) return;
    setOcupado(true);
    try {
      const res = await fetch("/api/seed/demo", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string; yaExistia?: boolean; contactos?: number; modulos?: string[] };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cargar la demo");
      toast.success(
        data.yaExistia ? "La demo ya estaba cargada" : `Demo cargada: ${data.contactos} contactos${data.modulos?.length ? ` + modulos ${data.modulos.join(", ")}` : ""}`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={cargar} disabled={ocupado} className="cursor-pointer">
      {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
      Cargar demo
    </Button>
  );
}
