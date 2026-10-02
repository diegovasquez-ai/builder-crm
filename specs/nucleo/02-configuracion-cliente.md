# Spec: Configuracion por cliente (requisito 2 del brief, parte 1)

**Carril**: completo (toca modelo de datos y nucleo)
**Estado**: aprobada (plan de Fase 0, 2026-10-01)
**Fecha**: 2026-10-01
**Escrita antes del codigo**: si

## Problema

Hoy la marca (nombre, logo, colores), el nombre de la PWA, el pipeline inicial y
los campos del contacto estan repartidos y hardcodeados en `src/` (`layout.tsx`,
`Sidebar.tsx`, `AppShell.tsx`, `globals.css`, `manifest.json`, `prompt.ts`...). Adaptar
el CRM a un cliente obliga a editar el nucleo, y eso hace imposible actualizar sin
conflictos. El brief exige: cambiar nombre, logo, colores y pipeline de un cliente
**sin editar ningun archivo del nucleo**.

## Decisiones del dueno

- D1 (Fase 0) La configuracion es un archivo TypeScript tipado: `config/cliente.ts`.
- D2 (Fase 0) El rol `asesor` se queda en la base; su etiqueta visible sale de la
  configuracion.

## Escenarios

1. **Marcar** — El miembro edita `config/cliente.ts` (nombre, nombre corto, logo,
   icono, color primario) y al reiniciar la app el sidebar, el login, la pestana, la
   PWA instalable y las notificaciones muestran la marca del cliente.
2. **Definir el pipeline** — Las etapas de `config/cliente.ts` existen en la base al
   arrancar (se crean si faltan, se renombran/recoloran si cambiaron, nunca se borran
   si tienen operaciones). Desde la UI se pueden seguir agregando etapas.
3. **Definir campos** — Los campos personalizados del contacto aparecen en el
   formulario de alta/edicion, en la ficha, en el panel del chat y (los marcados) en
   la tabla; se guardan y se filtran.
4. **Validar** — Un error en la configuracion (color invalido, etapa duplicada, campo
   sin clave) se detecta al arrancar y en `/api/health`, con un mensaje claro.
5. **Actualizar** — Traer una version nueva del nucleo no toca `config/` ni `public/marca/`.

## Requisitos

- FR-001 `config/cliente.ts` exporta la configuracion validada con el esquema zod de
  `src/lib/config/schema.ts` (`definirConfig`). Alias `@config/*` en tsconfig.
- FR-002 La configuracion incluye: `marca` (nombre, nombreCorto, descripcion, logo,
  icono, colorPrimario, colorFondo opcional, tema), `idioma`, `moneda`, `roles`
  (etiqueta del asesor), `pipeline` (nombre + etapas con clave, nombre, color,
  ganada/perdida), `contacto.campos`, `agente` (nombre, prompt base opcional, modelo
  opcional), `modulos` (nucleo apagable + modulos de `modules/`).
- FR-003 El color primario se inyecta como CSS variables en SSR (sin flash) y deriva el
  color de texto sobre primario por contraste. `globals.css` conserva los defaults.
- FR-004 `src/app/manifest.ts` genera el manifest de la PWA desde la configuracion;
  `public/manifest.json` desaparece. Los iconos de la PWA se generan con
  `npm run pwa:icons` a partir de `marca.icono`.
- FR-005 Los assets de marca viven en `public/marca/` (zona del cliente).
- FR-006 `sincronizarPipeline()` corre al arrancar (instrumentation) y es idempotente:
  upsert por `pipeline_stages.key`; no borra etapas con operaciones.
- FR-007 `contacts.custom_fields jsonb` (default `{}`). `POST/PUT /api/contacts`
  aceptan `customFields` y validan contra la configuracion (tipo, opciones,
  requerido). Tipos: texto, numero, seleccion, booleano, fecha.
- FR-008 `src/lib/config` no importa nada server-only: los componentes cliente leen la
  marca y los campos directamente.
- FR-009 Toda cadena de marca escrita a mano en el nucleo sale de la configuracion.

## Configuracion y modulos

Crea `config/cliente.ts` (valores por defecto de Builder CRM) y `public/marca/`.
`modulos` todavia no se consume para enrutar (Fase 4): aqui solo se define y valida.

## Modelo de datos

- `pipeline_stages.key text` (nullable; unica por pipeline).
- `contacts.custom_fields jsonb not null default '{}'`.
- Se regenera `20261001000000_base.sql` (pre-1.0.0, decision D2 de la spec 06).

## Agente de IA

El prompt base y el modelo pueden venir de la configuracion (`agente.prompt`,
`agente.modelo`); el cableado en `src/lib/agent` es de la Fase 6.

## Criterios de aceptacion

- CA-001 Cambiar `marca.nombre`, `marca.colorPrimario` y `marca.logo` en
  `config/cliente.ts` y reiniciar: sidebar, login, `<title>`, manifest y notificaciones
  cambian; `git status` no muestra cambios en `src/`.
- CA-002 Con `pipeline.etapas` de 7 etapas y una base vacia, al arrancar existen las 7
  en ese orden; cambiar un nombre y reiniciar lo refleja; borrar una etapa con
  operaciones de la config no la elimina de la base.
- CA-003 Un campo `seleccion` con opciones aparece en el formulario con sus opciones,
  se guarda en `custom_fields` y se ve en la ficha.
- CA-004 Un color invalido en la config hace que `/api/health` responda 503 con
  `error: "config_invalida"` y el detalle.
- CA-005 `typecheck + lint + build` en verde.

## Constitution Check

- I. Nucleo intocable: es justamente lo que lo hace posible; `config/` y
  `public/marca/` son zona del cliente.
- II. Spec antes que codigo: esta spec.
- III. Autoverificacion: `probar-instancia` compara marca y etapas con la config.
- IV. Cero secretos: la configuracion no lleva credenciales (van en env).

## Fuera de alcance

- Editar marca o campos desde la UI (la fuente de verdad es el archivo, que viaja con
  el repo del cliente y se versiona).
- Varios pipelines desde config (uno; los demas se crean desde la UI).
- Campos personalizados en operaciones (deals).
