# Spec: Conectores de canales (requisito 3 del brief)

**Carril**: completo (contrato publico: la interfaz de conector)
**Estado**: aprobada (plan de Fase 0, 2026-10-01)
**Fecha**: 2026-10-01
**Escrita antes del codigo**: si

## Problema

Hoy la salida de mensajes pasa por una interfaz comun (`ChannelAdapter.send` y
`deliverMessage`), pero la entrada no: cada webhook (Zernio, Meta directo) verifica,
deduplica e ingesta a su manera, y no hay forma uniforme de preguntar "este canal esta
conectado?". El brief pide una capa de conectores con interfaz comun (enviar, recibir
webhook, estado), con Zernio funcionando y la puerta abierta para un conector de la
API oficial de WhatsApp (Cloud API / Tech Provider) **sin implementarlo ahora**.

## Decisiones del dueno

- D1 (Fase 0) El codigo de Meta Cloud API directo no se borra ni se extiende: queda
  como conector parcial documentado.

## Escenarios

1. **Enviar** — `deliverMessage` busca el conector por `conversations.provider` y llama
   a `enviar`. Nada mas sale a la red por otro camino.
2. **Recibir** — `POST /api/webhooks/<conector>` verifica la firma con el conector,
   reclama el evento en `webhook_events` (idempotencia), responde 2xx rapido y procesa
   en `after()` con `conector.webhook.procesar`, que normaliza y persiste usando las
   mismas funciones de `ingest.ts`. El barrido (`GET` con secreto) reprocesa lo que
   quedo colgado, para cualquier conector.
3. **Estado** — Ajustes → Canales muestra, por conector, si esta configurado, que
   variables faltan y las cuentas conectadas; viene de `conector.estado()`.
4. **Agregar Cloud API** — Un desarrollador crea `conectores/meta-cloud.ts` completo
   siguiendo `conectores/README.md`, lo registra en el indice y agrega la ruta
   `/api/webhooks/meta-cloud` de 10 lineas. La bandeja y el agente no cambian.
5. **Leads por webhook** — Formularios externos pegan a `/api/webhooks/leads` (publico,
   con secreto), que antes vivia en `/api/webhook` y el middleware bloqueaba.

## Requisitos

- FR-001 `src/lib/channels/conector.ts` define `Conector { id, nombre, canales,
  enviar(), webhook?: { verificar, idEvento, procesar }, estado() }` y los tipos de
  mensaje saliente, resultado de envio y estado.
- FR-002 `src/lib/channels/conectores/index.ts` registra los conectores por id;
  `conectorParaConversacion(conv)` resuelve por `provider`.
- FR-003 `conectores/zernio.ts` implementa la interfaz completa reutilizando el codigo
  actual (envio por `inbox.sendMessage`, firma HMAC, `processZernioEvent`). Sin cambios
  de comportamiento ni de URL (`/api/webhooks/zernio` sigue siendo la que esta
  registrada en Zernio).
- FR-004 `conectores/meta-cloud.ts` implementa `enviar` y `estado` con el codigo de
  `meta-whatsapp.ts`; `webhook` queda sin implementar y documentado (la ingesta legacy
  sigue en `/api/webhooks/whatsapp` mientras `WHATSAPP_PROVIDER=meta`).
- FR-005 `src/lib/channels/webhook.ts` concentra la mecanica generica de webhooks
  (verificar, reclamar, `after()`, barrido) para que cada ruta sea minima e importe lo
  menos posible (Zernio exige 2xx en 5 s).
- FR-006 `GET /api/channels` devuelve `conectores: EstadoConector[]`; la UI los muestra.
- FR-007 El webhook de leads pasa a `/api/webhooks/leads` (publico por prefijo) y
  Ajustes muestra esa URL.
- FR-008 Credenciales solo por entorno (`ZERNIO_*`, `WHATSAPP_*`), nunca en codigo.

## Configuracion y modulos

Ninguno. (Un conector no es un modulo: es nucleo, porque la bandeja depende de el.)

## Modelo de datos

Ninguno. `webhook_events.provider` ya distingue el conector.

## Agente de IA

Sin cambios: responde por `deliverMessage`.

## Criterios de aceptacion

- CA-001 Un `POST /api/webhooks/zernio` con firma valida y un `message.received`
  termina con una fila en `messages` y un job del agente, exactamente como hoy.
- CA-002 Con firma invalida responde 401; repetido con el mismo id responde
  `duplicate: true`.
- CA-003 `GET /api/channels` incluye `conectores` con `zernio` y `meta-cloud`, cada uno
  con `configurado` y `faltan`.
- CA-004 `POST /api/webhooks/leads` sin sesion y con el secreto correcto crea el
  contacto; sin secreto responde 401.
- CA-005 `typecheck + lint + build` en verde.

## Constitution Check

- I. Nucleo intocable: los conectores son nucleo; un cliente no los edita, los
  configura por env.
- II. Spec antes que codigo: esta spec.
- III. Autoverificacion: CA-001..005; el simulador (Fase 7) sera un conector mas.
- IV. Cero secretos: solo variables de entorno.

## Fuera de alcance

- Implementar el conector Cloud API completo (ingesta, conexion desde la UI, Tech
  Provider). Queda la interfaz, el `enviar` existente y la guia.
- Mover la ingesta legacy de `/api/webhooks/whatsapp` al conector (se hace al
  implementar Cloud API).
