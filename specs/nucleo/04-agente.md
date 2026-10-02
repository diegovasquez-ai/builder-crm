# Spec: Agente de IA (requisito 4 del brief)

**Carril**: completo (toca modelo de datos, el loop del agente y la configuracion)
**Estado**: aprobada (plan de Fase 0, 2026-10-01)
**Fecha**: 2026-10-01
**Escrita antes del codigo**: si

## Problema

El agente existe y funciona (OpenRouter, historial por hilo, tools, config por canal),
pero (1) no puede actuar sobre el CRM generico: no mueve etapas, no actualiza la ficha,
no deja un resumen; (2) su prompt default es el de una inmobiliaria concreta y sus
tools de nicho viven en el nucleo; (3) la pausa (handoff) esta desacoplada: la tool
apaga la conversacion pero la UI solo enciende/apaga el contacto, asi que un hilo
derivado se ve "ON" y nadie lo puede reactivar; (4) envia por un camino propio en vez
de `deliverMessage`.

## Decisiones del dueno

- D1 (Fase 0) Si el repo ya tiene agente, se adapta; no se define un microservicio
  externo ahora.
- D2 (Fase 0) Visitas y propiedades pasan a modulos en la Fase 9; hasta entonces sus
  tools quedan en el nucleo pero fuera del prompt generico.

## Escenarios

1. **Calificar** — El cliente escribe; el agente responde por el mismo canal y, con lo
   que averigua, llama a `actualizar_contacto` (campos de `config/cliente.ts` marcados
   `agente`) y a `mover_etapa` cuando corresponde segun el prompt.
2. **Resumir** — Al terminar una conversacion util, el agente llama a `resumen_lead`;
   la ficha muestra "Resumen del agente" con fecha, y el panel del chat tambien.
3. **Derivar** — `derivar_asesor` pausa SOLO esa conversacion; el panel del chat lo
   muestra como pausado con el motivo y ofrece "Reactivar"; el contacto sigue con IA
   en sus otros hilos. El admin tambien puede pausar o reactivar a mano.
4. **Configurar** — El miembro define en `config/cliente.ts` el nombre del agente, el
   prompt base, el modelo y el mensaje de derivacion; `AGENT_MODEL` (env) manda sobre
   el modelo de la config; Ajustes -> Agente sigue pudiendo pisar prompt y tools por
   canal (cascada: canal -> global -> config -> default del nucleo).
5. **Extender** — Un modulo activo aporta tools (`servidor.tools`); aparecen en
   Ajustes -> Agente junto a las del nucleo y el modelo las puede usar.

## Requisitos

- FR-001 Tools genericas del nucleo: `mover_etapa` (por clave o nombre de etapa del
  pipeline por defecto; crea la operacion si el contacto no tiene una abierta; usa
  `setDealStage`), `actualizar_contacto` (nombre, email, telefono, notas y campos
  personalizados validados), `registrar_actividad` (nota o tarea con fecha),
  `resumen_lead` (texto + campos), `derivar_asesor`, `asignar_asesor`.
- FR-002 Registro de tools como mapa `{ definicion, descripcionUI, ejecutar }`; los
  nombres validos se calculan (nucleo + modulos activos); Ajustes -> Agente los lista.
- FR-003 `contacts.ai_summary text` + `ai_summary_at`; visibles en ficha y chat.
- FR-004 El prompt default del nucleo es generico y se arma con: marca y nombre del
  agente, reglas de estilo, catalogo de tools genericas, y un bloque CONTEXTO con el
  contacto (nombre, campos conocidos, etapa actual), las etapas disponibles (clave y
  nombre) y los campos a calificar (`agente.descripcion`). `config/agente.prompt` lo
  reemplaza como base.
- FR-005 Modelo: `agent_configs.model` -> `AGENT_MODEL` -> `config.agente.modelo` ->
  default del nucleo.
- FR-006 `PATCH /api/conversations/:id/agente` `{ enabled?, clearNeedsHuman? }` con
  acceso al contacto; el panel del chat muestra y cambia el estado de la CONVERSACION.
- FR-007 El agente responde SOLO por `deliverMessage(conversationId, { text }, "agent")`.
  Se elimina el transporte inyectable (`AgentSender`) y `adapters.ts`.
- FR-008 Mensaje de derivacion desde `config.agente.mensajeDerivacion`.
- FR-009 Se elimina `/api/agent/debug` (lo reemplaza el simulador de la Fase 7).

## Configuracion y modulos

`agente: { nombre, prompt?, modelo?, mensajeDerivacion? }` en `config/cliente.ts`.
Tools de modulos por `servidor.tools`.

## Modelo de datos

`contacts.ai_summary`, `contacts.ai_summary_at`. Base regenerada (pre-1.0.0).

## Agente de IA

Es esta spec.

## Criterios de aceptacion

- CA-001 Con el simulador (Fase 7): un mensaje "quiero un depto de 2 ambientes, tengo
  150 mil" termina con campos actualizados y la operacion en la etapa que indique el
  prompt.
- CA-002 `derivar_asesor` deja la conversacion en pausa y el panel muestra el motivo;
  "Reactivar" la vuelve a encender; otro hilo del mismo contacto sigue respondiendo.
- CA-003 `resumen_lead` aparece en la ficha con fecha.
- CA-004 Ajustes -> Agente lista las tools de un modulo activo.
- CA-005 `typecheck + lint + build` en verde.

## Constitution Check

- I. Nucleo intocable: prompt y tools de nicho salen a config y modulos.
- II. Spec antes que codigo: esta spec.
- III. Autoverificacion: CA-001..004 los ejercita `probar-instancia` con el simulador.
- IV. Cero secretos: OPENROUTER_API_KEY solo en env.

## Fuera de alcance

- API para un cerebro externo (microservicio): queda documentada como extension
  posible en CLAUDE.md, no se implementa.
- Agendar generico: el agendamiento es del modulo `visitas` (Fase 9).
