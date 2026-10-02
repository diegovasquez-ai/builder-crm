# Spec: Modulos (requisito 2 del brief, parte 2)

**Carril**: completo (contrato publico: la interfaz de un modulo)
**Estado**: aprobada (plan de Fase 0, 2026-10-01)
**Fecha**: 2026-10-01
**Escrita antes del codigo**: si

## Problema

Lo especifico de un cliente (pedidos, citas, propiedades, visitas...) hoy solo se puede
agregar editando `src/`: nuevas carpetas en `src/app`, items en el sidebar, tablas en
el schema, tools en el agente. Eso rompe las actualizaciones. Hace falta una carpeta
`modules/` donde cada agregado viva completo (pantallas, API, tablas, tools, seed) y se
encienda o apague desde la configuracion, sin tocar el nucleo.

## Decisiones del dueno

- D1 (Fase 0) Mixto: automatizaciones, actividades, plantillas, campana y push quedan
  en el nucleo pero apagables por config; visitas/calendario y propiedades pasan a
  `modules/` (Fase 9).

## Escenarios

1. **Crear** — El miembro (o la skill `crear-modulo`) copia `modules/_plantilla/` a
   `modules/<nombre>/`, completa `manifiesto.ts` y `servidor.tsx`, agrega su
   `migrations/0000_<nombre>.sql` y lo agrega a `config/modulos.json`.
2. **Ver** — Al arrancar, el modulo aparece en el menu lateral (y movil) en la seccion
   que declara, sus paginas responden en `/m/<nombre>/...` y su API en
   `/api/m/<nombre>/...`, ya protegidas por `requireMember`.
3. **Apagar** — Quitarlo de `config/modulos.json` lo saca del menu y sus rutas
   responden 404; sus tablas no se tocan.
4. **Migrar** — `npm run db:migrar` aplica tambien `modules/<activo>/migrations/*.sql`.
5. **Calificar** — Los campos de contacto que declara el modulo (`campos`) se suman a
   los de `config/cliente.ts` en formulario, ficha, tabla y agente.
6. **Agente** — Las tools que declara el modulo se suman a las del nucleo cuando esta
   activo (cableado en la Fase 6).

## Requisitos

- FR-001 Un modulo es una carpeta `modules/<nombre>/` (nombre en snake_case) con:
  `manifiesto.ts` (seguro para el navegador: nombre, titulo, version, nav, campos),
  `servidor.tsx` (paginas, api, tools, seed), `migrations/`, `README.md`.
- FR-002 La lista de modulos activos vive en `config/modulos.json` (`activos`); la lee
  `config/cliente.ts`, el runner de migraciones y el generador del registro.
- FR-003 `scripts/generar-registro-modulos.mjs` genera
  `src/lib/modules/registro.generated.ts` (servidor) y
  `registro-cliente.generated.ts` (navegador) con imports estaticos de los modulos
  activos. Corre al cargar `next.config.ts` (dev, build, Docker) y en
  `npm run typecheck`. Es idempotente (no reescribe si no cambio).
- FR-004 `src/app/m/[modulo]/[[...ruta]]/page.tsx` y
  `src/app/api/m/[modulo]/[[...ruta]]/route.ts` resuelven la pagina o el handler por
  patron (`""`, `"nueva"`, `"[id]"`, `"[id]/editar"`), exigen miembro y pasan
  `{ params, searchParams, member }`. Modulo inactivo o ruta sin match: 404.
- FR-005 El sidebar y el menu movil se construyen desde: funciones del nucleo activas
  (`modulos.nucleo`) + `nav` de los manifiestos activos. Las paginas del nucleo
  apagables (`/automatizaciones`, `/activities`, `/plantillas`, `/reportes`) responden
  404 cuando estan apagadas (layout servidor con `notFound()`).
- FR-006 `camposContacto()` devuelve los campos de la config mas los de los modulos
  activos, sin claves repetidas (error de config si se repiten).
- FR-007 Las migraciones de un modulo deben habilitar RLS en sus tablas; el runner lo
  fuerza igual al final.
- FR-008 Un modulo nunca importa de otro modulo ni del nucleo mas que de `@/lib/*`,
  `@/components/ui/*`, `@/db` y los tipos publicos de `@/lib/modules/types`.

## Configuracion y modulos

`config/modulos.json` nuevo. `modules/_plantilla/` como plantilla (no activable: el
generador ignora carpetas que empiezan con `_`). `modules/ejemplo/` minimo para
validar el mecanismo (inactivo por defecto).

## Modelo de datos

Ninguno en el nucleo. Cada modulo trae sus tablas en `migrations/`.

## Agente de IA

Se define el tipo `ToolModulo` (misma forma que las tools del nucleo). El cableado en
`src/lib/agent` es de la Fase 6.

## Criterios de aceptacion

- CA-001 Con `ejemplo` en `config/modulos.json`, `npm run build` termina, aparece
  "Ejemplo" en el menu y `/m/ejemplo` y `/api/m/ejemplo` responden; sin el, 404 y no
  esta en el menu.
- CA-002 `npm run db:migrar --status` lista `modules/ejemplo/0000_ejemplo.sql` solo
  cuando el modulo esta activo.
- CA-003 Apagar `automatizaciones` en `config/cliente.ts` saca el item del menu y
  `/automatizaciones` responde 404.
- CA-004 Un modulo con un campo `clave` repetido respecto de `config/cliente.ts` hace
  que `/api/health` responda `config_invalida`.
- CA-005 `typecheck + lint + build` en verde.

## Constitution Check

- I. Nucleo intocable: los modulos son la via; `src/` no se edita para agregar uno.
- II. Spec antes que codigo: esta spec.
- III. Autoverificacion: CA-001..005; `probar-instancia` abre cada `/m/<modulo>`.
- IV. Cero secretos: las credenciales de un modulo van en env, documentadas en su README.

## Fuera de alcance

- Modulos con layouts propios o rutas fuera de `/m/<nombre>` (el prefijo es fijo para
  que no choquen con el nucleo).
- Instalar modulos desde un registro remoto (se copian carpetas).
