# Modulo `ejemplo` — Tareas

Modulo minimo que existe para mostrar (y probar) el mecanismo de modulos. Se puede
borrar en una instancia real sin tocar nada mas.

| Que | Donde |
|---|---|
| Menu | "Tareas" en la seccion Productividad (`manifiesto.ts`) |
| Pagina | `/m/ejemplo` (`servidor.tsx` → `paginas[""]`) |
| API | `GET/POST /api/m/ejemplo`, `PATCH/DELETE /api/m/ejemplo/<id>` |
| Tabla | `ejemplo_tareas` (`migrations/0000_ejemplo.sql`, con RLS) |
| Campo de contacto | `ejemplo_prioridad` (seleccion Alta/Media/Baja) |
| Tool del agente | `anotar_tarea` |
| Seed | dos tareas para el primer miembro |

Activar: agregar `"ejemplo"` a `config/modulos.json` → `activos` y correr
`npm run db:migrar`. Desactivar: quitarlo de la lista (la tabla queda).
