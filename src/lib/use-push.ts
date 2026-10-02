"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Estado y acciones de las notificaciones push en ESTE dispositivo.
 *
 *   unsupported   el navegador no puede (Safari en pestana, navegadores viejos)
 *   ios-install   es iPhone/iPad y la app no esta instalada en la pantalla de inicio:
 *                 ahi el push directamente no existe, hay que instalarla primero
 *   denied        el usuario bloqueo las notificaciones para este sitio
 *   subscribed    este dispositivo esta registrado en el servidor
 *   ready         se puede activar
 */
export type PushState =
  | "loading"
  | "unsupported"
  | "ios-install"
  | "denied"
  | "ready"
  | "subscribed";

interface ServerStatus {
  configured: boolean;
  publicKey: string | null;
  devices: number;
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  // `new ArrayBuffer` explicito: TS 5.7+ distingue ArrayBuffer de SharedArrayBuffer y
  // `pushManager.subscribe` solo acepta el primero.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [server, setServer] = useState<ServerStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    if (!supported) {
      setState(isIOS() && !isStandalone() ? "ios-install" : "unsupported");
      return;
    }

    const res = await fetch("/api/push/status").catch(() => null);
    const status: ServerStatus | null = res?.ok ? await res.json() : null;
    setServer(status);

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    setState(existing ? "subscribed" : "ready");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async (): Promise<string | null> => {
    if (!server?.publicKey) {
      return "El servidor no tiene las claves VAPID configuradas.";
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return "Permiso denegado. Se activa desde los ajustes del navegador.";
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(server.publicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return body.error ?? "No se pudo registrar el dispositivo.";
      }

      await refresh();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Error activando notificaciones.";
    } finally {
      setBusy(false);
    }
  }, [server, refresh]);

  const unsubscribe = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      await refresh();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Error desactivando.";
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const sendTest = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/api/push/test", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return body.error ?? "No se pudo enviar la prueba.";
    if (body.noDevices) return "Este usuario no tiene dispositivos registrados.";
    if (body.sent === 0) return "No se entrego a ningun dispositivo.";
    return null;
  }, []);

  return {
    state,
    busy,
    configured: server?.configured ?? false,
    devices: server?.devices ?? 0,
    subscribe,
    unsubscribe,
    sendTest,
    refresh,
  };
}
