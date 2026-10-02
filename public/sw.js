/* Service worker del CRM.
 *
 * Hace UNA cosa: recibir push y mostrar la notificacion. A proposito NO tiene handler
 * de `fetch`: interceptar las requests es lo que rompe las PWA en iOS Safari (pantalla
 * en blanco al reabrir, sesion perdida). No hay cache offline: el CRM necesita red.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "CRM", body: "", url: "/", tag: undefined };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Si el CRM ya esta abierto, enfocarlo y navegar; si no, abrir una ventana.
      for (const client of list) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) return client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

/* El navegador rota la suscripcion (pasa sobre todo en iOS). Re-suscribimos con la
 * misma clave y avisamos al servidor cual era el endpoint viejo para reemplazarlo. */
self.addEventListener("pushsubscriptionchange", (event) => {
  const old = event.oldSubscription;
  const key = old && old.options ? old.options.applicationServerKey : undefined;
  if (!key) return;

  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: key })
      .then((sub) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...sub.toJSON(), oldEndpoint: old.endpoint }),
        })
      )
      .catch(() => {})
  );
});
