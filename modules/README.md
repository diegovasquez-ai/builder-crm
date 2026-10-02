# modules/ — zona del cliente

Cada agregado especifico de un cliente (pedidos, citas, propiedades, visitas...) es un
**modulo**: una carpeta autocontenida que el nucleo descubre por configuracion. Agregar
un modulo nunca toca `src/`.

```
modules/
|-- README.md            <- esta guia
|-- _plantilla/          <- copiar para empezar (no activable)
|-- ejemplo/             <- modulo minimo funcionando (tareas); borrable
`-- <nombre>/
    |-- manifiesto.ts    <- nav, campos, titulo (seguro para el navegador)
    |-- servidor.tsx      <- paginas, api, tools, seed
    |-- componentes/     <- UI del modulo
    |-- migrations/      <- SQL idempotente, con RLS
    `-- README.md
```

## Como se activa

`config/modulos.json`:

```json
{ "activos": ["propiedades", "visitas"] }
```

Esa lista la leen tres cosas: `config/cliente.ts` (validacion), el runner de
migraciones (`npm run db:migrar` aplica `modules/<activo>/migrations/`) y el generador
del registro (`scripts/generar-registro-modulos.mjs`), que escribe
`src/lib/modules/*.generated.ts` con imports estaticos de los modulos activos. El
generador corre solo al arrancar `next dev`, en `next build` y en `npm run typecheck`:
solo los modulos activos entran al bundle.

Apagar un modulo = quitarlo de la lista. Sus rutas pasan a 404, desaparece del menu y
sus tablas quedan intactas.

## Que puede aportar un modulo

| Pieza | Donde | Como llega al nucleo |
|---|---|---|
| Entradas del menu | `manifiesto.nav` | Sidebar y menu movil, en la seccion declarada |
| Paginas | `servidor.paginas` | `/m/<nombre>/<patron>` via el catch-all `src/app/m/[modulo]/[[...ruta]]` |
| API | `servidor.api` | `/api/m/<nombre>/<patron>`, ya con `requireMember` |
| Campos del contacto | `manifiesto.campos` | Se suman a `config/cliente.ts`: formulario, ficha, tabla, chat y agente |
| Tools del agente | `servidor.tools` | Se suman a las del nucleo mientras el modulo esta activo |
| Tablas | `migrations/*.sql` | Las aplica el runner, en orden, una sola vez |
| Datos demo | `servidor.seed` | `npm run seed` |

Patrones de ruta: `""` (principal), `"nueva"`, `"[id]"`, `"[id]/editar"`. Un segmento
entre corchetes captura y llega en `params`. El patron con mas segmentos literales
gana.

## Reglas

1. **Nombre** en snake_case, igual a la carpeta. Tablas, claves de campos y tools con
   el nombre del modulo como prefijo (`visitas_citas`, `visitas_zona`, `agendar_visita`).
2. **Sin tocar `src/`.** Si algo no se puede hacer desde el modulo, es una mejora del
   nucleo: se pide al repo original, no se parchea en la instancia.
3. **Importar solo** `@/lib/*`, `@/components/{ui,layout,shared}/*`, `@/db`, `@/lib/modules/types` y
   paquetes del `package.json`. Nunca otro modulo.
4. **RLS en toda tabla** (`alter table ... enable row level security` + politica de
   lectura). El runner lo fuerza igual, pero sin politica nadie lee por la API publica.
5. **Credenciales por env**, documentadas en el README del modulo y en `.env.example`.
6. **Spec antes** (`specs/<cliente>/spec.md`) y **autoverificacion despues**
   (`probar-instancia` abre `/m/<nombre>` y prueba que guarda y muestra datos).

## Crear uno

```bash
cp -r modules/_plantilla modules/<nombre>
# completar manifiesto.ts, servidor.tsx, migrations/0000_<nombre>.sql, README.md
# agregar "<nombre>" a config/modulos.json
npm run db:migrar && npm run typecheck && npm run dev
```

O pedirselo a Claude Code con la skill `crear-modulo`.
