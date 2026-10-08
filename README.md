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
- **Entrar con Google** y otros proveedores, opcional: ver [`docs/GOOGLE-AUTH.md`](docs/GOOGLE-AUTH.md).
- **Invitaciones por correo** y "olvide mi contrasena", opcional: ver
  [`docs/CORREO.md`](docs/CORREO.md). Sin esto, el admin crea la cuenta y pasa la
  contrasena temporal a mano, que es como viene de fabrica.
- **Automatizaciones** (disparador -> filtros -> acciones), **PWA** instalable.
- **Simulador**: chatear con el agente sin ningun canal conectado (demos y
  autoverificacion).
- **Modulos**: todo lo especifico de un cliente vive en `modules/` y se enciende por
  configuracion. Plantilla de nicho incluida: **inmobiliaria** (propiedades + visitas).

## Requisitos

- Node.js 22 y npm. **Nada mas para probarlo**: el modo local trae su propia base.
  En Windows, clona en una ruta corta (`C:\proyectos\...`): con carpetas muy
  anidadas, el compilador de Next falla por el limite de caracteres del sistema de
  archivos.
- Para una instancia de verdad: una cuenta de **Supabase** (un proyecto por cliente;
  el plan gratuito alcanza), o tu propio Postgres mas GoTrue en el VPS (ver
  [`docs/SUPABASE-EN-VPS.md`](docs/SUPABASE-EN-VPS.md)).
- Para desplegar: un VPS con **Coolify** y un dominio.
- Opcional: **OpenRouter** (agente), **Zernio** (canales), bucket S3 (documentos).
- **Claude Code** con el repo abierto; ver [`CLAUDE.md`](CLAUDE.md) y
  [`docs/MCP.md`](docs/MCP.md).

## Probarlo en tu PC (2 minutos, sin crear ninguna cuenta)

```bash
git clone https://github.com/diegovasquez-ai/builder-crm.git && cd builder-crm
npm install
npm run local
```

Y ya esta: `http://localhost:3000` con el CRM lleno de datos de demostracion. No hace
falta Supabase, ni Docker, ni un archivo `.env`.

`npm run local` levanta un **Postgres embebido** (un paquete de npm compilado a
WebAssembly, guardado en `.local/db`), aplica las mismas migraciones que una instancia
desplegada —con su RLS—, carga los datos demo y abre el CRM. **No hay login**: en modo
local no hay servidor de autenticacion, asi que entras directo como administrador y el
menu lateral te lo recuerda.

| | |
|---|---|
| `npm run local -- --reset` | borra la base local y empieza de cero |
| `npm run local -- --sin-datos` | sin datos de demostracion |
| `npm run local -- --puerto 3001` | otro puerto |

Para que el **agente responda** en el simulador hace falta una clave de OpenRouter:
copia `.env.example` a `.env.local` y pone `OPENROUTER_API_KEY`. Sin ella el CRM
funciona igual (los mensajes entran a la bandeja y crean el contacto), solo que nadie
contesta del otro lado.

Lo que el modo local **no** tiene, porque necesita una instancia de verdad: login,
equipo con roles, invitaciones por correo y la busqueda semantica del modulo
propiedades (el Postgres embebido no trae pgvector).

## Con tu propio Supabase (para adaptar y desplegar)

```bash
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

1. Base y Auth. Dos caminos y conviene elegir antes de empezar:
   - **Supabase cloud**, un proyecto por cliente. Mas rapido, con panel y respaldos; el
     plan gratuito pausa los proyectos inactivos.
   - **Autoalojados en el mismo Coolify** (Postgres + GoTrue): sin cuenta de Supabase,
     sin pausas y sin costo por cliente, pero los respaldos son tuyos. Es el camino de
     la instancia de demostracion. Guia:
     [`docs/SUPABASE-EN-VPS.md`](docs/SUPABASE-EN-VPS.md).

   Despues, desde tu maquina: `npm run db:migrar` y `npm run admin:crear`.
2. En Coolify: aplicacion desde el repo (build pack **Dockerfile**, puerto 3000,
   dominio) y las variables de [`.env.example`](.env.example), **todas en runtime**. No
   hace falta marcar ninguna como "Build Variable": desde 1.2.2 el servidor le pasa al
   navegador la configuracion publica en tiempo de ejecucion, asi que la misma imagen
   sirve para cualquier instancia. El `Dockerfile` igual acepta las `NEXT_PUBLIC_*` como
   build args, por si construis en una plataforma que las hornea (Vercel).
3. Deploy. Las migraciones corren solas al arrancar el contenedor.
4. `curl https://<dominio>/api/health` -> `{"ok":true,"version":"<la del package.json>","db":"ok"}`.
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
tests/             invariantes que fallan en silencio (firma, ventana 24h, roles)
.local/            base embebida del modo local (no se versiona)
src/               nucleo (app, lib, components, db)
supabase/          migraciones del nucleo (base, RLS, primer admin)
scripts/           migrar, crear-admin, seed-demo, verificar-instancia, zernio:*
docker/, Dockerfile, docker-compose.yml
.claude/skills/    el arnes: 7 skills del flujo one-shot
docs/              MCP, agente, Zernio, Supabase en tu VPS, entrar con Google, correo
```

## Scripts

| Comando | Que hace |
|---|---|
| `npm run local` | **probarlo en tu PC sin cuentas**: Postgres embebido, datos demo, sin login |
| `npm run dev` / `build` / `start` | desarrollo contra tu Supabase, build, servidor |
| `npm test` | invariantes del nucleo (vitest, sin base ni red, ~1 s) |
| `npm run typecheck` / `lint` | gate tecnico (CI corre los tres + build) |
| `npm run db:migrar` / `db:status` | migraciones del nucleo + modulos activos |
| `npm run admin:crear -- --email --password` | crea o promueve un administrador |
| `npm run claves:supabase` / `auth:preparar` | base y Auth en tu propio VPS, sin Supabase cloud |
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

**Propietaria.** Copyright (c) 2026 Diego Vásquez. Los miembros de IA Builder Lab
pueden adaptarlo, desplegar instancias para sus clientes y cobrar por ellas; no
pueden publicar el codigo ni redistribuirlo como plantilla o producto. Los terminos
completos estan en [`LICENSE`](LICENSE).

Nacio como fork de [auto-crm](https://github.com/Hainrixz/auto-crm), cuya licencia
MIT se conserva en `LICENSE` para las partes que vienen de ahi. La arquitectura de
entrega para agencias toma ideas de
[vocero-crm](https://github.com/kevinrivm/vocero-crm).
