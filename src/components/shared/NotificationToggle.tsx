"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { marca } from "@/lib/config";

const STORAGE_KEY = "crm-notifications";

// El estado vive en localStorage y en la API Notification del navegador; se lee con
// useSyncExternalStore para no setear estado dentro de un efecto. En el servidor
// (y durante la hidratacion) todo vale `false`, por eso existe el estado "Cargando".
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
const notifyChange = () => window.dispatchEvent(new Event("storage"));

export function NotificationToggle() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const supported = useSyncExternalStore(
    subscribe,
    () => "Notification" in window,
    () => false
  );
  const enabled = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(STORAGE_KEY) === "true",
    () => false
  );

  const toggle = async () => {
    if (!supported) {
      toast.error("Tu navegador no soporta notificaciones");
      return;
    }

    if (!enabled) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        localStorage.setItem(STORAGE_KEY, "true");
        notifyChange();
        toast.success("Notificaciones activadas");

        // Show test notification
        new Notification(marca().nombreCorto, {
          body: "Las notificaciones estan activas. Te avisaremos de seguimientos pendientes.",
        });
      } else {
        toast.error("Permiso de notificaciones denegado");
      }
    } else {
      localStorage.setItem(STORAGE_KEY, "false");
      notifyChange();
      toast.success("Notificaciones desactivadas");
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border opacity-60">
        <div className="flex items-center gap-3">
          <BellOff className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Notificaciones del navegador</p>
            <p className="text-xs text-muted-foreground">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!supported) return null;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        {enabled ? (
          <Bell className="h-5 w-5 text-primary" />
        ) : (
          <BellOff className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">
            Notificaciones del navegador
          </p>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? "Recibiras alertas de seguimientos vencidos"
              : "Activa para recibir alertas de seguimientos"}
          </p>
        </div>
      </div>
      <Button
        variant={enabled ? "default" : "outline"}
        size="sm"
        onClick={toggle}
        className="cursor-pointer"
      >
        {enabled ? "Desactivar" : "Activar"}
      </Button>
    </div>
  );
}
