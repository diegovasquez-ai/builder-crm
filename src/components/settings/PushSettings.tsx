"use client";

import { Bell, BellOff, BellRing, Smartphone, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePush } from "@/lib/use-push";

/**
 * Activar/desactivar push en ESTE dispositivo. Cada asesor lo hace una vez en su
 * telefono; los avisos de las automatizaciones llegan ahi.
 */
export function PushSettings() {
  const push = usePush();

  const onToggle = async () => {
    const error =
      push.state === "subscribed" ? await push.unsubscribe() : await push.subscribe();
    if (error) toast.error(error);
    else
      toast.success(
        push.state === "subscribed"
          ? "Notificaciones desactivadas en este dispositivo"
          : "Notificaciones activadas en este dispositivo"
      );
  };

  const onTest = async () => {
    const error = await push.sendTest();
    if (error) toast.error(error);
    else toast.success("Prueba enviada. Deberia llegar en unos segundos.");
  };

  if (push.state === "loading") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border opacity-60">
        <BellOff className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Comprobando este dispositivo...</p>
      </div>
    );
  }

  if (push.state === "ios-install") {
    return (
      <div className="p-3 rounded-lg border space-y-2">
        <div className="flex items-center gap-3">
          <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Primero instala el CRM en tu iPhone</p>
            <p className="text-xs text-muted-foreground">
              En iPhone las notificaciones solo funcionan con la app instalada en la
              pantalla de inicio.
            </p>
          </div>
        </div>
        <ol className="text-xs text-muted-foreground list-decimal pl-9 space-y-0.5">
          <li>
            Toca el boton de compartir <Share className="inline h-3 w-3" /> en Safari
          </li>
          <li>Elige &quot;Agregar a pantalla de inicio&quot;</li>
          <li>Abre el CRM desde el icono nuevo y vuelve a esta pantalla</li>
        </ol>
      </div>
    );
  }

  if (push.state === "unsupported") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border">
        <BellOff className="h-5 w-5 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-medium">Este navegador no soporta notificaciones push</p>
          <p className="text-xs text-muted-foreground">
            Prueba con Chrome, Edge o Firefox, o instala el CRM en el telefono.
          </p>
        </div>
      </div>
    );
  }

  if (!push.configured) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/5">
        <BellOff className="h-5 w-5 text-amber-600 shrink-0" />
        <div>
          <p className="text-sm font-medium">Faltan las claves VAPID en el servidor</p>
          <p className="text-xs text-muted-foreground">
            Genera con <code>npx web-push generate-vapid-keys</code> y carga
            NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT.
          </p>
        </div>
      </div>
    );
  }

  const subscribed = push.state === "subscribed";
  const denied = push.state === "denied";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg border">
        <div className="flex items-center gap-3 min-w-0">
          {subscribed ? (
            <BellRing className="h-5 w-5 text-primary shrink-0" />
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">Avisos en este dispositivo</p>
            <p className="text-xs text-muted-foreground">
              {denied
                ? "Bloqueadas por el navegador. Se reactivan desde los ajustes del sitio."
                : subscribed
                  ? `Activas. Tienes ${push.devices} dispositivo${push.devices === 1 ? "" : "s"} registrado${push.devices === 1 ? "" : "s"}.`
                  : "Recibe un aviso cuando te asignen un contacto."}
            </p>
          </div>
        </div>
        <Button
          variant={subscribed ? "outline" : "default"}
          size="sm"
          onClick={onToggle}
          disabled={push.busy || denied}
          className="cursor-pointer shrink-0"
        >
          {push.busy ? "..." : subscribed ? "Desactivar" : "Activar"}
        </Button>
      </div>

      {subscribed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onTest}
          className="cursor-pointer text-xs"
        >
          Enviar notificacion de prueba
        </Button>
      )}
    </div>
  );
}
