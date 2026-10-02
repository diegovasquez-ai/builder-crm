# Modulo `propiedades` — catalogo y busqueda

Catalogo de propiedades que el agente consulta para responder con datos reales.

| Que | Donde |
|---|---|
| Menu | "Propiedades" (Operaciones) |
| Pagina | `/m/propiedades` (listado) |
| API | `GET /api/m/propiedades[?q=texto]` |
| Tabla | `propiedades` (`migrations/0000_propiedades.sql`, pgvector, RLS para miembros) |
| Tools del agente | `buscar_propiedades` (por criterios) y `buscar_info_propiedades` (por direccion o link) |
| Seed | 6 propiedades de demostracion (sin embeddings) |
| Sync | `npm run sync:tokko` (`scripts/sync-tokko.ts`): trae el catalogo de Tokko Broker |

## Variables de entorno (todas opcionales)

| Variable | Para que | Sin ella |
|---|---|---|
| `OPENAI_API_KEY` | Embeddings (busqueda semantica por criterios) | La busqueda usa filtros SQL (operacion, tipo, precio, ambientes, zona) |
| `TOKKO_API_KEY` | Sincronizar el catalogo desde Tokko | Se cargan propiedades por seed o por SQL |
| `FIRECRAWL_API_KEY` | Leer un link de portal para encontrar la propiedad | `buscar_info_propiedades` solo acepta direccion o nombre |

Para otro origen de catalogo (Excel, otra API), copiar `scripts/sync-tokko.ts` y mapear
a las columnas de `tabla.ts`; `external_id` es la clave de upsert.
