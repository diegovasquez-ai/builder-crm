# Modulo `<nombre>`

Una frase: que resuelve y para que cliente o nicho.

| Que | Donde |
|---|---|
| Menu | `manifiesto.ts` → `nav` |
| Paginas | `servidor.tsx` → `paginas` (`/m/<nombre>/...`) |
| API | `servidor.tsx` → `api` (`/api/m/<nombre>/...`) |
| Tablas | `migrations/*.sql` (prefijo `<nombre>_`, con RLS) |
| Campos de contacto | `manifiesto.ts` → `campos` |
| Tools del agente | `servidor.tsx` → `tools` |
| Seed | `servidor.tsx` → `seed` |

## Variables de entorno

Si el modulo necesita credenciales (una API externa, por ejemplo), listarlas aqui y en
`.env.example`, nunca en el codigo.

## Activar

1. Agregar `"<nombre>"` a `config/modulos.json` → `activos`.
2. `npm run db:migrar`.
3. Reiniciar la app (o `npm run build`).
