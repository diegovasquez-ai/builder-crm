# Builder CRM

**El CRM multicanal con agente de IA que los miembros de IA Builder Lab entregan a sus
clientes.** Una bandeja para WhatsApp, Instagram y Messenger, un agente que califica
leads y mueve el pipeline, y un arnes de Claude Code que adapta, despliega y prueba
una instancia por cliente con un solo prompt.

> *"Adapta Builder CRM para una inmobiliaria llamada Casa Sur, con modulo de
> propiedades y agendamiento de visitas, y despliegalo en mi Coolify."*
> Claude escribe la spec, configura, construye, despliega, prueba y entrega la URL.

## Que trae el nucleo

- **Login con roles** admin y asesor (Supabase Auth): un asesor ve solo sus contactos.
- **Bandeja** multicanal en tiempo real (Zernio: WhatsApp, Instagram DM, Messenger),
  ventana de 24 h y plantillas de WhatsApp.
- **Contactos** con ficha, documentos (bucket S3 opcional), campos personalizados por
  cliente y resumen del agente.
- **Pipeline** kanban con etapas configurables que el agente puede mover.
- **Agente de IA** (OpenRouter, modelo por variable): lee el historial, responde por
  el canal, actualiza la ficha, mueve etapas, registra actividades, deja un resumen y
  deriva a una persona (pausa por conversacion).
- **Reportes** reales por periodo y **dashboard** honesto.
- **Ajustes**: canales, agente por canal, equipo, notificaciones push.
- **Automatizaciones** (disparador -> filtros -> acciones), **PWA** instalable.
- **Simulador**: chatear con el agente sin ningun canal conectado (demos y
  autoverificacion).
- **Modulos**: todo lo especifico de un cliente vive en `modules/` y se enciende por
  configuracion. Plantilla de nicho incluida: **inmobiliaria** (propiedades + visitas).

## Requisitos

- Node.js 22 y npm.
- Una cuenta de **Supabase** (un proyecto por cliente; el plan gratuito alcanza).
- Para desplegar: un VPS con **Coolify** y un dominio.
- Opcional: **OpenRouter** (agente), **Zernio** (canales), bucket S3 (documentos).
- **Claude Code** con el repo abierto; ver [`CLAUDE.md`](CLAUDE.md) y
  [`docs/MCP.md`](docs/MCP.md).

## Funcionando en 15 minutos (local)

```bash
git clone https://github.com/diegovasquez-ai/builder-crm.git && cd builder-crm
npm install
cp .env.example .env.local        # completar al menos Supabase (4 variables)
npm run db:migrar                 # crea tablas, RLS y el trigger del primer admin
npm run dev                       # http://localhost:3000
```

1. Abre `/signup`: mientras no haya miembros, el registro esta abierto y **la primera
   cuenta queda como administrador**. Despues se cierra solo.
2. En el inicio pulsa **Cargar demo** (o `npm run seed`) para ver el CRM lleno.
3. Abre **Simulador** y chatea con el agente (necesita `OPENROUTER_API_KEY`).
4. Conecta WhatsApp/Instagram/Messenger cuando quieras: skill `conectar-zernio`.

Sin interfaz: `npm run admin:crear -- --email a@b.com --password 'xxxxxxxx'`.

## Desplegar en Coolify

Resumen (el detalle paso a paso esta en la skill `deploy-coolify`):

1. Proyecto Supabase -> `npm run db:migrar` y `npm run admin:crear` desde tu maquina.
2. En Coolify: aplicacion desde el repo (build pack **Dockerfile**, puerto 3000,
   dominio). Variables: las `NEXT_PUBLIC_*` como **build args**, el resto en runtime
   (lista en [`.env.example`](.env.example)).
3. Deploy. Las migraciones corren solas al arrancar el contenedor.
4. `curl https://<dominio>/api/health` -> `{"ok":true,"version":"1.0.0",...}`.
5. `node scripts/seed-demo.mjs --url https://<dominio>` y
   `node scripts/verificar-instancia.mjs --url https://<dominio> --email ... --password ...`.

Tambien funciona con `docker compose up -d --build` (solo la app; la base es
Supabase) o en Vercel (`vercel.json` + barridos por GitHub Actions).

## Adaptarlo a un cliente (sin tocar el nucleo)

Zona del cliente: `config/cliente.ts` (marca, pipeline, campos, agente),
`config/modulos.json`, `modules/<nombre>/`, `public/marca/`, `specs/<cliente>/`.
Nucleo: `src/`, `supabase/`, `scripts/`, Docker. Reglas en
[`specs/CONSTITUCION.md`](specs/CONSTITUCION.md).

```ts
// config/cliente.ts
import { plantillaInmobiliaria } from "./plantillas/inmobiliaria";
export default definirConfig({ ...plantillaInmobiliaria, marca: { ...plantillaInmobiliaria.marca, nombre: "Casa Sur" } });
```

`config/modulos.json`: `{ "activos": ["propiedades", "visitas"] }` -> `npm run db:migrar`.

Con Claude Code: abre el repo y pide la adaptacion en lenguaje natural; la skill
`adaptar-a-cliente` sigue el flujo entender -> especificar -> configurar -> construir ->
desplegar -> probar -> entregar. Para un modulo nuevo: `crear-modulo`. Para una
plantilla nueva: `nueva-plantilla-nicho`.

## Estructura

```
config/            zona del cliente: cliente.ts, modulos.json, plantillas/
modules/           modulos (ejemplo, propiedades, visitas, _plantilla)
public/marca/      logo e icono del cliente
specs/             constitucion, plantilla de spec, specs del nucleo y del cliente
src/               nucleo (app, lib, components, db)
supabase/          migraciones del nucleo (base, RLS, primer admin)
scripts/           migrar, crear-admin, seed-demo, verificar-instancia, zernio:*
docker/, Dockerfile, docker-compose.yml
.claude/skills/    el arnes: 7 skills del flujo one-shot
docs/              MCP, agente, guia de Zernio
```

## Scripts

| Comando | Que hace |
|---|---|
| `npm run dev` / `build` / `start` | desarrollo, build, servidor |
| `npm run typecheck` / `lint` | gate tecnico (CI corre los dos + build) |
| `npm run db:migrar` / `db:status` | migraciones del nucleo + modulos activos |
| `npm run admin:crear -- --email --password` | crea o promueve un administrador |
| `npm run seed` | datos de demostracion (`POST /api/seed/demo`) |
| `npm run verificar -- --url ...` | autoverificacion de una instancia |
| `npm run zernio:setup` / `zernio:webhook` / `zernio:whatsapp` | canales via Zernio (`connect:whatsapp` para Meta directo) |
| `npm run pwa:icons` | iconos de la PWA desde `public/marca/icono.png` |
| `npm run sync:tokko` | catalogo del modulo propiedades desde Tokko |

## Versiones

La version corre en `package.json`, se ve en `/api/health` y al pie del menu. SemVer
desde el punto de vista de quien opera una instancia:

| | Cuando sube |
|---|---|
| **Mayor** (`2.0.0`) | Hay que hacer algo a mano al actualizar (variable nueva obligatoria, cambio del contrato de modulos o de conectores). |
| **Menor** (`1.1.0`) | Funciones nuevas. Actualizar es mergear y redesplegar. |
| **Parche** (`1.0.1`) | Arreglos. Actualizar es mergear y redesplegar. |

Como traer una version nueva a una instancia adaptada: [`ACTUALIZAR.md`](ACTUALIZAR.md).
Cambios por version: [`CHANGELOG.md`](CHANGELOG.md). Secretos, roles y RLS:
[`SEGURIDAD.md`](SEGURIDAD.md).

## Licencia

MIT. Nacio como fork de [auto-crm](https://github.com/Hainrixz/auto-crm) (MIT);
la arquitectura de entrega para agencias toma ideas de
[vocero-crm](https://github.com/kevinrivm/vocero-crm).
