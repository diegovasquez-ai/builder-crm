# Spec: Simulador de conversaciones (requisito 5.6 del brief)

**Carril**: completo (nuevo conector + rutas publicas de la instancia)
**Estado**: aprobada (plan de Fase 0, 2026-10-01)
**Fecha**: 2026-10-01
**Escrita antes del codigo**: si

## Problema

Para probar el agente hoy hay que tener un numero de WhatsApp conectado y escribirle
desde un telefono. Eso impide (1) la autoverificacion automatica de una instancia
recien desplegada y (2) mostrar el CRM funcionando en una reunion de venta antes de
que el cliente conecte su numero.

## Decisiones del dueno

- D1 (Fase 0) El simulador es un conector mas (`provider = "simulador"`): la
  conversacion simulada entra a la bandeja como cualquier otra, el agente la atiende
  por el mismo camino, y la salida nunca llega a la red.

## Escenarios

1. **Demo** — El admin abre `/simulador`, elige el canal a simular (WhatsApp, Instagram
   o Messenger), escribe como si fuera un cliente y ve la respuesta del agente en
   segundos. Al lado ve lo que el agente fue cambiando en el CRM: etapa, campos,
   resumen, actividades.
2. **Bandeja** — La misma conversacion aparece en Conversaciones marcada como
   "Simulador"; se puede abrir, ver los mensajes y el estado del agente.
3. **Autoverificacion** — `probar-instancia` crea una conversacion por API, manda un
   mensaje, espera la respuesta y comprueba que la etapa cambio.
4. **Seguridad** — Un asesor no ve el menu ni puede usar las rutas (403); nada de lo
   simulado sale por Zernio ni Meta.

## Requisitos

- FR-001 `PROVIDERS` incluye `"simulador"`; `conectores/simulador.ts` implementa
  `enviar` (devuelve exito con id `sim:<uuid>`, sin red) y `estado`; sin `webhook`.
- FR-002 `POST /api/simulador/conversaciones { canal, nombre? }` (admin) crea un
  contacto sintetico (fuente `simulador`, etiqueta `simulador`, propietario = quien lo
  crea) con su identidad y una conversacion `provider="simulador"`. Devuelve ids.
- FR-003 `POST /api/simulador/mensajes { conversationId, texto }` (admin) ingesta el
  mensaje entrante con `ingestMessage` (sin encolar) y corre el agente de forma
  sincrona; devuelve `{ agente: { ok, reason, reply, toolCalls }, messages }`.
  Rechaza conversaciones que no sean del simulador. `maxDuration = 60`.
- FR-004 `GET /api/simulador/conversaciones` (admin) lista las simuladas recientes.
- FR-005 `/simulador`: pagina solo admin (404 para el resto) y apagable con
  `modulos.nucleo.simulador`; item en el menu (seccion Inteligencia) visible solo para
  admin.
- FR-006 La bandeja marca las conversaciones con `provider === "simulador"`.
- FR-007 Sin `OPENROUTER_API_KEY` la ruta responde 503 `agente_no_configurado` con un
  mensaje claro (el simulador no finge respuestas).

## Configuracion y modulos

`modulos.nucleo.simulador` (ya existe, default true).

## Modelo de datos

Ninguno: `provider` distingue lo simulado.

## Agente de IA

El prompt recibe la guia de canal `simulador`; todo lo demas es identico a produccion.

## Criterios de aceptacion

- CA-001 Crear conversacion + mandar "Hola, busco informacion" devuelve una respuesta
  del agente y la conversacion aparece en `/conversations` marcada como Simulador.
- CA-002 Con un prompt que indique mover a "contactado" al primer mensaje, la
  operacion del contacto simulado queda en esa etapa (visible en el panel).
- CA-003 Un asesor recibe 403 en las rutas y no ve el item del menu.
- CA-004 `webhook_events` y los conectores reales no registran nada durante una
  simulacion.
- CA-005 `typecheck + lint + build` en verde.

## Constitution Check

- I. Nucleo intocable: es nucleo; no toca config del cliente.
- II. Spec antes que codigo: esta spec.
- III. Autoverificacion: es la base de `probar-instancia`.
- IV. Cero secretos: nada nuevo en env.

## Fuera de alcance

- Clientes simulados automaticos con guion (tipo Laboratorio de vocero): el miembro
  escribe a mano o `probar-instancia` manda un guion fijo.
- Simular adjuntos, plantillas o estados de entrega.
