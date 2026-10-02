# Modulo `visitas` — visitas y calendario

Coordinacion de visitas presenciales (a una propiedad, un local, una obra) con agenda
mensual. Es parte de la plantilla inmobiliaria, pero no tiene nada de inmobiliario:
sirve para cualquier negocio que agende encuentros.

| Que | Donde |
|---|---|
| Menu | "Visitas" (Operaciones) y "Calendario" (Productividad) |
| Paginas | `/m/visitas` (lista por estado) y `/m/visitas/calendario` (mes) |
| API | `GET/POST /api/m/visitas`, `PATCH/DELETE /api/m/visitas/<id>` |
| Tabla | `visitas` (`migrations/0000_visitas.sql`, RLS por contacto visible) |
| Tool del agente | `agendar_visita` (deja la visita en coordinacion; una persona confirma) |
| Seed | 4 visitas de ejemplo sobre los primeros contactos |

Estados: `coordinating` (sin fecha confirmada), `scheduled` (fecha y hora),
`completed`, `cancelled`. Un asesor ve solo las visitas de sus contactos.

Sin variables de entorno. La sincronizacion con Google Calendar no esta implementada.
