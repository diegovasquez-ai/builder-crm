# Agente de IA: como funciona

El agente responde los mensajes entrantes de WhatsApp, Instagram y Messenger, averigua
lo que el negocio necesita saber de cada persona y lo deja escrito en el CRM. Es
generico: lo que sabe del negocio viene de `config/cliente.ts`, de los modulos activos
y de Ajustes -> Agente.

## Flujo de un turno

1. Entra un mensaje por el webhook del conector (`src/lib/channels/webhook.ts`) y la
   ingesta (`ingest.ts`) crea o actualiza contacto, conversacion y mensaje, y encola un
   job (`agent_jobs`) con debounce de 6 s por conversacion.
2. El webhook dispara el worker `POST /api/agent/process` con `AGENT_WORKER_SECRET`;
   el worker toma el job (`claimAgentJob`) y corre `runAgentForConversation`
   (`src/lib/agent/index.ts`).
3. El agente carga los ultimos 30 mensajes del hilo, resuelve la configuracion del
   canal, arma el system prompt y entra al loop de tool calling (hasta 6 rondas).
4. La respuesta sale por `deliverMessage` (unico camino de salida), que elige el
   conector por `conversations.provider`: Zernio, Meta directo o el simulador.
5. Si algo quedo colgado (el `after()` murio), los barridos (`GET` de
   `/api/agent/process`, `/api/webhooks/zernio`, `/api/automations/process` con el
   secreto) lo retoman: cada 30 min dentro del proceso en Coolify, o por
   `vercel.json` + GitHub Actions en Vercel.

## Cuando NO responde

- El contacto tiene el agente apagado o "necesita humano" (kill-switch global).
- La conversacion esta pausada (`derivar_asesor` o pausa manual desde el chat).
- El agente esta apagado para ese canal (Ajustes -> Agente; Instagram y Messenger
  arrancan apagados).
- Falta `OPENROUTER_API_KEY`, no hay mensajes del cliente, o el ultimo mensaje ya es
  del agente.

## System prompt

Cascada: `agent_configs[canal]` (Ajustes -> Agente, por canal) -> `crm_settings`
(Ajustes -> Agente, global) -> `config.agente.prompt` (plantilla o cliente) -> default
generico del nucleo (`src/lib/agent/prompt.ts`). Placeholders: `{{agente}}`,
`{{negocio}}`, `{{canal}}`, `{{fecha}}`.

Al final el agente agrega siempre:

- **CANAL**: guia de estilo segun la red (largo, tono, links).
- **CONTEXTO**: nombre y datos conocidos del cliente, resumen previo, etapa actual,
  **PIPELINE** (clave: nombre de cada etapa) y **DATOS A AVERIGUAR** (los campos de la
  config con `agente.descripcion` que todavia estan vacios).
- **EQUIPO** (si puede asignar): asesores activos y quien tiene el contacto.

## Herramientas

| Tool | Que hace |
|---|---|
| `actualizar_contacto` | Guarda nombre, email, telefono, notas y campos personalizados (validados contra la config). |
| `mover_etapa` | Mueve la operacion abierta del contacto a una etapa (por clave o nombre); si no hay operacion, la crea. Pasa por `setDealStage`, asi que dispara automatizaciones. |
| `registrar_actividad` | Nota o tarea con fecha en la ficha. |
| `resumen_lead` | Resumen de 2-4 frases en `contacts.ai_summary` (ficha y chat). |
| `derivar_asesor` | Pausa el agente en ESTE hilo, marca "necesita humano" con motivo y envia `config.agente.mensajeDerivacion`. |
| `asignar_asesor` | Asigna el contacto a un miembro por nombre (dispara el aviso push). |
| *de modulos* | Lo que declare cada modulo activo en `servidor.tools` (ej. `buscar_propiedades`, `agendar_visita`). |

Cada tool se puede apagar por canal desde Ajustes -> Agente. El registro es dinamico:
`listarTools()` en `src/lib/agent/tools.ts`.

## Modelo y proveedor

OpenRouter (OpenAI-compatible) con `OPENROUTER_API_KEY`. Modelo:
`agent_configs.model` -> `AGENT_MODEL` (entorno) -> `config.agente.modelo` -> default
del nucleo. Cualquier modelo con tool calling sirve.

## Probar sin canal

`/simulador` (solo admin): escribes como cliente, el agente responde en la misma
llamada y el panel muestra etapa, campos, resumen y actividades. Es tambien lo que usa
`scripts/verificar-instancia.mjs`. Las conversaciones simuladas aparecen en la
bandeja con la marca `sim`.

## Cambiar el comportamiento

| Quiero… | Toco… |
|---|---|
| Que pregunte otros datos | `contacto.campos[].agente` en `config/cliente.ts` |
| Que mueva a otra etapa en otro momento | el prompt (`config.agente.prompt` o Ajustes -> Agente) |
| Que sepa de un catalogo o reserve citas | un modulo con tools (`modules/README.md`) |
| El mensaje al derivar | `config.agente.mensajeDerivacion` |
| Otro modelo | `AGENT_MODEL` |
| Distinto tono en Instagram | Ajustes -> Agente -> Instagram (prompt propio del canal) |
