---
name: probar-instancia
description: |
  Autoverificacion de una instancia de Builder CRM (local o desplegada): health check,
  inicio de sesion, marca y pipeline aplicados, conversacion de prueba por el simulador
  con respuesta del agente y cambio de etapa, y modulos activos. Corrige hasta que pase.
  Activar cuando el usuario dice: proba la instancia, verifica que funcione, autoverifica,
  esta todo ok?, antes de entregar, o al final de deploy-coolify / adaptar-a-cliente.
allowed-tools: Bash, Read, Edit, Grep
---

# Probar una instancia

> Instancia: $ARGUMENTS

Nada se entrega sin esto en verde (constitucion, principio III). La prueba la haces
tu, no el miembro ni el cliente.

## 1. Correr el script

```bash
node scripts/verificar-instancia.mjs \
  --url https://<dominio> \
  --email <admin demo> --password '<contrasena>' \
  --secreto '<AGENT_WORKER_SECRET de la instancia>' \
  [--marca "Casa Sur"] [--etapas "nuevo,calificado,visita_agendada"] [--modulos propiedades,visitas] \
  [--guion "Hola, busco un depto de 2 dormitorios en Providencia, tengo 150 mil para comprar"]
```

Sin `--url` usa `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` / `http://localhost:3000`; sin
`--secreto` usa `AGENT_WORKER_SECRET` del entorno (lee `.env.local` si existe). Los
valores esperados de marca, etapas y modulos salen de `config/cliente.ts` y
`config/modulos.json` de la instancia que estas probando; pasalos para que el script
los compare.

Que comprueba, en orden:

1. **Responde**: `GET /api/health` -> `ok: true` (si no, imprime `faltan` o el error).
2. **Login**: password grant contra Supabase Auth con el email/contrasena y
   `GET /api/team/me` con la sesion -> rol `admin`.
3. **Marca**: `/manifest.webmanifest` -> `name` = `--marca`.
4. **Pipeline y config**: `GET /api/simulador/estado` -> etapas (claves) contienen
   `--etapas`, modulos activos contienen `--modulos`, campos configurados.
5. **Conversacion de prueba**: crea una conversacion por el simulador, manda el guion
   (2-3 mensajes), espera la respuesta del agente y comprueba que la conversacion esta
   en la bandeja y que el contacto quedo con operacion en una etapa (o la etapa
   cambio).
6. **Modulos**: `GET /api/m/<modulo>` responde 200 con la sesion, para cada activo.

Sale con codigo 1 si algo fallo e imprime una tabla con cada check.

## 2. Si algo falla

| Check | Causa tipica | Arreglo |
|---|---|---|
| health 503 `env_invalida` | variable obligatoria sin definir | agregarla en Coolify y redesplegar |
| health 503 `config_invalida` | `config/cliente.ts` no valida | el cuerpo trae el detalle; corregir y redesplegar |
| login falla | la cuenta no existe o la contrasena cambio | `npm run admin:crear` otra vez (es upsert) |
| marca no coincide | build viejo o `config/cliente.ts` sin commitear | commit + redeploy |
| etapas faltan | la sincronizacion no corrio (instancia arrancada sin base) | reiniciar el contenedor; ver logs `[boot] pipeline sincronizado` |
| agente no responde (`agente_no_configurado`) | falta `OPENROUTER_API_KEY` | agregarla; si el cliente no la da, decirlo en la entrega |
| agente responde pero no mueve la etapa | el prompt no indica cuando mover | ajustar `agente.prompt` en la config (o Ajustes -> Agente) y repetir |
| modulo 404 | no esta en `config/modulos.json` del build desplegado | activar, commit, redeploy, `db:migrar` |

**Antes de dar un problema por real, comproba la version dos o tres veces:**

```bash
for i in 1 2 3; do curl -s https://<dominio>/api/health; echo; sleep 3; done
```

Coolify suele dejar el contenedor viejo sirviendo un rato despues de un despliegue
"completado", asi que el dominio responde alternando las dos versiones y la mitad de los
checks miran codigo viejo. Si ves versiones distintas, reinicia la aplicacion (en la
interfaz, o `POST /api/v1/applications/<uuid>/restart`) y recien entonces verifica. Visto
dos veces en la instancia de demostracion.

Corrige, redespliega y vuelve a correr el script. Repite hasta verde. Si un check no
puede cumplirse por una decision externa (sin OpenRouter, sin logo), dejalo
explicito en la entrega: nunca lo escondas.

## 3. Prueba manual complementaria (demo de venta)

Abre `/simulador` como admin, elige WhatsApp, escribe como cliente y mira el panel
"Lo que ve el CRM": etapa, campos y resumen deben cambiar. Luego `/conversations`
(la conversacion marcada `sim`), `/pipeline` (la operacion en su columna) y
`/reportes`. Si usas Playwright (skill `playwright-cli`), toma capturas de esas
cuatro pantallas para la entrega.
