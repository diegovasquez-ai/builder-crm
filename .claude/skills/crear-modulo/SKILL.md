---
name: crear-modulo
description: |
  Crea un modulo nuevo en modules/<nombre>/ respetando el contrato del nucleo
  (manifiesto, servidor, migraciones con RLS, campos, tools del agente, seed) y lo activa
  en config/modulos.json. Activar cuando el usuario dice: crea un modulo, necesito una
  seccion de <pedidos|citas|propiedades|...>, agrega una tabla para el cliente, el CRM
  tiene que manejar <cosa>, o cuando adaptar-a-cliente lo requiere.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Crear un modulo

> Modulo a crear: $ARGUMENTS

Un modulo es una carpeta autocontenida que el nucleo descubre por configuracion.
Antes de escribir, lee `modules/README.md` (reglas), `src/lib/modules/types.ts`
(contrato) y `modules/ejemplo/` (modulo minimo funcionando).

## 1. Definir

- **Nombre** en snake_case, igual a la carpeta (`pedidos`, `citas`, `propiedades`).
- Que **pantallas** tiene (`""` principal, `nueva`, `[id]`, `[id]/editar`), que **API**,
  que **tablas** (prefijo `<nombre>_`), que **campos de contacto** aporta (prefijo
  `<nombre>_` en la clave), que **tools** le da al agente, y que **seed**.
- Si hay spec del cliente (`specs/<cliente>/spec.md`), la seccion "Configuracion y
  modulos" ya lo dice. Si no, escribe la spec ligera primero.

## 2. Crear la carpeta

```bash
cp -r modules/_plantilla modules/<nombre>
```

Completa:

- `manifiesto.ts`: `nombre`, `titulo`, `descripcion`, `version`, `nav` (icono de
  lucide, seccion Operaciones | Productividad | Inteligencia), `campos`.
  **Seguro para el navegador**: nada de base de datos ni `server-only`.
- `tabla.ts` (si hay tablas): `pgTable` de drizzle, espejo exacto de la migracion.
- `migrations/0000_<nombre>.sql`: `create table if not exists`, indices, `alter table
  ... enable row level security` y una politica de lectura (`public.contacto_visible`
  si cuelga de un contacto; `public.es_miembro()` si es catalogo; `public.es_admin()`
  si es sensible). Idempotente.
- `servidor.tsx`: `paginas`, `api` (handlers reciben `{ params, member }`, ya pasaron
  `requireMember`; filtra por `ownerFilter(member)` / `canAccessContactId` lo que cuelga
  de contactos), `tools` (nombre unico, `descripcionUI`, `ejecutar(args, ctx)` devuelve
  `{ ok, data | error }`), `seed` idempotente.
- `componentes/`: UI. Importa solo `@/components/{ui,layout,shared}/*`, `@/lib/*`.
- `README.md`: tabla de que hay donde, variables de entorno (si las hay), como activar.

## 3. Activar y migrar

1. Agrega `"<nombre>"` a `config/modulos.json` -> `activos`.
2. `npm run db:migrar` (aplica `modules/<nombre>/migrations/`).
3. `npm run typecheck && npm run lint && npm run build`.

## 4. Verificar

- `npm run dev` y abrir `/m/<nombre>`: la pagina carga, el item esta en el menu.
- `curl` (con sesion) o la UI: crear un registro, verlo, editarlo.
- Si aporta campos: aparecen en el formulario de contacto y en la ficha.
- Si aporta tools: aparecen en Ajustes -> Agente IA; probar con `/simulador` que el
  agente las usa.
- Si tiene variables de entorno: agregarlas a `.env.example` con guia y al README.

Commit: `Agregar modulo <nombre>`.

## Lo que NO se hace

- Tocar `src/` para "ayudar" al modulo. Si el contrato no alcanza, es una mejora del
  nucleo: anotarla y proponerla al repo original.
- Importar de otro modulo.
- Tablas sin RLS, claves de campos sin prefijo, tools con nombres genericos que choquen
  con las del nucleo (`mover_etapa`, `actualizar_contacto`, `registrar_actividad`,
  `resumen_lead`, `derivar_asesor`, `asignar_asesor`).
