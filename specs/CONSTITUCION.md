# Constitucion de Builder CRM

Principios no negociables del proyecto. Toda spec, todo modulo y toda sesion de Claude
Code se rigen por esto. Cambiarla es una decision del dueno del repo y se registra en
`CHANGELOG.md`.

**Version**: 1.0.0 · **Ratificada**: 2026-10-01

## Principios

### I. El nucleo no se modifica para un cliente

Todo lo especifico de un cliente vive en **configuracion** (`config/cliente.ts`) o en
**modulos** (`modules/<nombre>/`). El nucleo (`src/`, `supabase/migrations/`,
`scripts/`, `Dockerfile`) es el mismo en todas las instancias y solo cambia con una
version nueva del repo original.

- Marca, pipeline, campos del contacto y modulos activos: configuracion.
- Pantallas, tablas, rutas de API y tools del agente propias de un cliente: un modulo.
- Si una adaptacion no se puede hacer sin tocar `src/`, es un bug del nucleo: se
  reporta al repo original como mejora generica, no se parchea en la instancia.

**Razon**: una instancia que edita el nucleo no puede actualizarse sin conflictos, y
el valor de la plantilla es que las actualizaciones lleguen a todos los clientes.

### II. Toda funcionalidad nueva parte de una spec

Antes de escribir codigo existe un `spec.md` (plantilla en `specs/_plantilla.md`)
con problema, escenarios observables, requisitos numerados y criterios de
aceptacion. Una adaptacion de cliente va en `specs/<cliente>/`; un cambio del nucleo
en `specs/nucleo/`.

- Carril **completo** cuando toca modelo de datos, contrato publico o nucleo.
- Carril **ligero** (solo `spec.md`) cuando es configuracion, un modulo o UI.
- Una spec escrita despues del codigo lo declara en su encabezado.

**Razon**: la spec es lo que permite que un miembro, Claude y el cliente hablen de lo
mismo, y es el estado durable entre sesiones.

### III. Nada se entrega sin pasar la autoverificacion

Una instancia esta "terminada" cuando `scripts/verificar-instancia.mjs` (skill
`probar-instancia`) pasa en verde contra la instancia desplegada: responde el health
check, se puede iniciar sesion, la marca y el pipeline del cliente estan aplicados,
una conversacion de prueba entra por el simulador, el agente responde y mueve la
etapa, y los modulos nuevos guardan y muestran datos.

- "Compila" no es "funciona". El gate tecnico (`typecheck + lint + build`) es el piso.
- Quien implementa prueba; no se delega la prueba al cliente ni al miembro.
- Si algo falla, se diagnostica, se corrige y se vuelve a verificar hasta verde.

**Razon**: el miembro entrega la URL en una reunion con su cliente; no hay segunda
oportunidad para que "casi" funcione.

### IV. Cero secretos en el codigo

Credenciales, tokens y URLs con secretos van en variables de entorno (`.env.local`
en local, variables de la plataforma en Coolify). El repo solo versiona
`.env.example` y `.mcp.json.example`, con cada variable explicada y sin valores.

- Nada de datos de clientes reales en seeds, fixtures, specs ni commits.
- Las claves `NEXT_PUBLIC_*` son publicas por diseno: solo van ahi las que lo son.
- Todas las tablas tienen RLS activado; la API publica de Supabase no expone datos.
- Antes de publicar: escaneo del historial (gitleaks).

**Razon**: cada miembro clona este repo para varios clientes; un secreto filtrado se
multiplica por cada instancia.

## Gobernanza

- Esta constitucion manda sobre `CLAUDE.md`, las skills y cualquier instruccion de
  sesion. Si chocan, gana la constitucion.
- Enmiendas: propuesta escrita, aprobacion del dueno, version nueva (mayor si se
  quita o redefine un principio; menor si se agrega o amplia; parche si es
  redaccion), y entrada en `CHANGELOG.md`.
- Cada spec incluye un **Constitution Check**: una linea por principio.
