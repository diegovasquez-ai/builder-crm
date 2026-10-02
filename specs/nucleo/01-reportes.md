# Spec: Reportes reales (requisito 1 del brief, "reportes visuales basicos")

**Carril**: completo (toca modelo de datos: origen del mensaje)
**Estado**: aprobada (plan de Fase 0, 2026-10-01)
**Fecha**: 2026-10-01
**Escrita antes del codigo**: si

## Problema

`/reportes` es una maqueta con numeros inventados ("$1.24M") y el dashboard muestra
deltas y sparklines falsos ("+12% vs mes pasado"). En una demo de venta eso es un
riesgo: el cliente pregunta de donde sale el numero. El brief pide reportes visuales
basicos que funcionen.

## Decisiones del dueno

- D1 (Fase 0) Reportes es nucleo, apagable por config (`modulos.nucleo.reportes`).

## Escenarios

1. **Ver el periodo** — El miembro abre Reportes, elige 7 / 30 / 90 dias y ve KPIs y
   graficos calculados sobre los datos reales de ese periodo (un asesor solo sobre sus
   contactos; el admin sobre todo).
2. **Entender el embudo** — Cuantas operaciones hay por etapa del pipeline por defecto
   y cuanto valor; cuantas se ganaron y perdieron en el periodo y la tasa de cierre.
3. **Ver de donde vienen** — Contactos nuevos por fuente y conversaciones nuevas por
   canal.
4. **Medir al agente** — Mensajes entrantes, cuantos salientes los escribio el agente y
   cuantos una persona, derivaciones a humano, y tiempo medio de primera respuesta.
5. **Dashboard honesto** — Las tarjetas del inicio muestran valores y comparaciones
   reales (ultimos 7 dias vs los 7 anteriores) o nada; sin sparklines inventadas.

## Requisitos

- FR-001 `messages.origin` (`agent | human | template | webhook`, nullable) escrito por
  `deliverMessage` segun el origen; la ingesta de entrantes lo deja nulo.
- FR-002 `src/lib/reportes.ts` calcula, con `ownerFilter`, para un rango de dias:
  KPIs (contactos nuevos, conversaciones nuevas, mensajes entrantes, % respondido por
  el agente, operaciones ganadas y su valor, tasa de cierre, primera respuesta media),
  contactos por fuente, conversaciones por canal, conversaciones y mensajes por dia,
  embudo por etapa, derivaciones. Excluye `provider = "simulador"`.
- FR-003 `/reportes` es server-rendered con `?dias=7|30|90` (default 30) y pasa los
  datos a componentes cliente de graficos (recharts, ya instalado). Sin datos muestra
  estados vacios, no ceros disfrazados.
- FR-004 El dashboard (`/`) usa comparaciones reales (7 dias vs 7 anteriores) y una
  serie diaria real en las tarjetas; se elimina `mockSparkline`.
- FR-005 Se elimina `ReportesMockup.tsx`.

## Configuracion y modulos

Ninguno nuevo.

## Modelo de datos

`messages.origin text` (base regenerada, pre-1.0.0).

## Agente de IA

Sin cambios (sus salientes llevan `origin = "agent"`).

## Criterios de aceptacion

- CA-001 Con la base vacia, `/reportes` carga sin error y muestra estados vacios.
- CA-002 Con el seed demo (Fase 9), los KPIs coinciden con conteos SQL directos.
- CA-003 Un asesor ve solo lo de sus contactos.
- CA-004 Las conversaciones simuladas no suman en Reportes.
- CA-005 `typecheck + lint + build` en verde.

## Constitution Check

- I. Nucleo intocable: nucleo, sin nada del cliente.
- II. Spec antes que codigo: esta spec.
- III. Autoverificacion: `probar-instancia` abre /reportes y espera 200.
- IV. Cero secretos: no aplica.

## Fuera de alcance

- Exportar reportes, comparar periodos arbitrarios, reportes por asesor para el admin
  (el admin ve el total).
