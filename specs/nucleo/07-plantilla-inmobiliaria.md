# Spec: Plantilla inmobiliaria y datos de demostracion (requisitos 7 y 6 del brief)

**Carril**: completo (saca tablas del nucleo a modulos)
**Estado**: aprobada (plan de Fase 0, 2026-10-01)
**Fecha**: 2026-10-01
**Escrita antes del codigo**: si

## Problema

El CRM nacio para una inmobiliaria y lo inmobiliario (visitas, calendario, catalogo
Tokko, busqueda semantica, prompt) esta dentro del nucleo. El brief pide una
**plantilla de nicho** que se active desde la configuracion sin tocar el nucleo, con
pipeline, campos, agente calificador y datos de demo coherentes, lista para una
reunion de venta.

## Decisiones del dueno

- D1 (Fase 0) Visitas/calendario y propiedades/Tokko pasan a `modules/`.
- D2 Datos demo: ninguno real; nombres y telefonos inventados.

## Escenarios

1. **Activar** — El miembro importa `plantillaInmobiliaria` en `config/cliente.ts`,
   pone `["propiedades", "visitas"]` en `config/modulos.json`, corre `db:migrar` y
   reinicia: pipeline de 7 etapas, 5 campos, menu con Propiedades, Visitas y
   Calendario, y el agente calificando.
2. **Demo** — `npm run seed` (o el boton del inicio) carga contactos, conversaciones,
   operaciones, visitas y propiedades coherentes con una inmobiliaria; el simulador
   responde con esas propiedades.
3. **Generico** — Sin la plantilla, el nucleo no tiene nada inmobiliario (ni tablas, ni
   tools, ni textos).

## Requisitos

- FR-001 `modules/visitas`: tabla `visitas`, paginas `/m/visitas` y
  `/m/visitas/calendario`, API, tool `agendar_visita`, seed.
- FR-002 `modules/propiedades`: tabla `propiedades` (pgvector), funcion
  `propiedades_buscar`, pagina `/m/propiedades`, API, tools `buscar_propiedades`
  (semantica con OpenAI o filtros SQL sin ella) y `buscar_info_propiedades`, seed de 6
  propiedades, `scripts/sync-tokko.ts`.
- FR-003 El nucleo deja de tener `visits`, `properties`, pgvector, Tokko, Firecrawl,
  embeddings, Google Sheets y las tools de nicho; `base.sql` se regenera.
- FR-004 `config/plantillas/inmobiliaria.ts` con pipeline (Nuevo lead, Calificado,
  Visita agendada, Visita realizada, Negociacion, Cerrado ganado, Cerrado perdido),
  campos (tipo_operacion, tipo_propiedad, zona, presupuesto, dormitorios), prompt
  calificador y modulos activos.
- FR-005 Seed de demostracion del nucleo (`src/lib/seed-demo.ts`): contactos,
  conversaciones con mensajes (entrantes y salientes con origen), operaciones por
  etapa y actividades, con valores de campos personalizados generados segun la
  configuracion; luego el seed de cada modulo activo. Idempotente. Expuesto como
  `POST /api/seed/demo` (admin o secreto del worker) y `npm run seed`.
- FR-006 Las conversaciones del seed usan el conector `simulador` para que se pueda
  responder y el agente conteste en la demo; los reportes excluyen solo los contactos
  con fuente `simulador` (los creados desde /simulador), no estas.

## Configuracion y modulos

`config/plantillas/inmobiliaria.ts`; `config/modulos.json` con los dos modulos cuando
se usa la plantilla.

## Modelo de datos

Tablas `visitas` y `propiedades` en sus modulos. Nucleo sin ellas.

## Agente de IA

Tools de nicho en los modulos; prompt calificador en la plantilla.

## Criterios de aceptacion

- CA-001 Con la plantilla activa, `typecheck + lint + build` en verde y
  `/m/propiedades`, `/m/visitas`, `/m/visitas/calendario` compilan.
- CA-002 Sin modulos activos, no existe nada inmobiliario en el bundle ni en base.sql.
- CA-003 `POST /api/seed/demo` dos veces deja la misma cantidad de filas.
- CA-004 Con el seed y el simulador, el agente ofrece propiedades del catalogo demo
  (requiere OPENROUTER_API_KEY; sin OPENAI_API_KEY usa filtros).

## Constitution Check

- I. Nucleo intocable: es el movimiento que lo cumple.
- II. Spec antes que codigo: esta spec.
- III. Autoverificacion: CA-001..003 por build y script; CA-004 con credenciales.
- IV. Cero secretos: Tokko/Firecrawl/OpenAI por env, documentados en el modulo.

## Fuera de alcance

- Sincronizacion con Google Calendar; portales distintos de Tokko (se documenta como
  copiar el script de sync).
