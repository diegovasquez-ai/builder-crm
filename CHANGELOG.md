# Cambios

Que trae cada version de Builder CRM y que hacer para actualizar. SemVer segun lo que
le importa a quien opera una instancia (ver "Versiones" en el [README](README.md)):
mayor = pasos manuales, menor = funciones nuevas, parche = arreglos.

## 1.5.1 — 2026-10-08

### Actualizar desde 1.5.0

Trae esta version. Solo cambian el arnes y la documentacion.

### Arreglado

- **La skill `deploy-coolify` daba por hecho Supabase cloud.** Creaba un proyecto en
  supabase.com por MCP y no mencionaba una sola vez `docs/SUPABASE-EN-VPS.md`, aunque el
  CRM solo usa Supabase para Postgres y GoTrue y los dos se pueden autoalojar en el mismo
  Coolify, que es como corre la instancia de demostracion. Ahora el paso 1 plantea los dos
  caminos con sus costos (cloud pausa los proyectos inactivos; autoalojado deja los
  respaldos de tu lado) y, para el autoalojado, da el orden de pasos que no es obvio:
  base, `npm run claves:supabase`, `npm run auth:preparar`, GoTrue, y recien ahi
  `npm run db:migrar`, porque la ultima migracion pone un disparador sobre `auth.users`.
- **La misma skill mandaba marcar variables como `is_build_time: true`.** Quedo obsoleto
  en 1.2.2, cuando la configuracion publica paso a servirse en ejecucion, y ademas la API
  de Coolify 4.3 rechaza ese campo: seguir la instruccion al pie fallaba. Ahora dice que
  van todas en runtime y por que.
- El README resume los dos caminos en el paso 1 de "Desplegar en Coolify".

## 1.5.0 — 2026-10-08

### Actualizar desde 1.4.3

Trae esta version y corre `npm install` (entra una dependencia de desarrollo). No hay
migraciones ni variables nuevas, y nada cambia en una instancia desplegada.

### Agregado

- **`npm run local`: el CRM corriendo en tu PC sin crear una cuenta en ningun lado.**
  Clonar, `npm install`, `npm run local`, y el CRM abre con datos de demostracion. Sin
  Supabase, sin Docker y sin ningun archivo `.env`. Levanta un Postgres embebido
  (`@electric-sql/pglite`, un paquete de npm compilado a WebAssembly) en `.local/db`, le
  agrega lo que Supabase trae de fabrica y un Postgres pelado no (los roles
  `anon`/`authenticated`/`service_role`, el esquema `auth`, `auth.uid()` y `auth.users`),
  aplica **las mismas migraciones** que una instancia desplegada con su RLS, da de alta
  el administrador de la demo por el mismo disparador del primer admin que corre en
  produccion, y carga la demo. Opciones: `--reset`, `--sin-datos`, `--puerto`.
- **No hay login en modo local**, porque no hay servidor de autenticacion al que
  preguntarle: quien abre la URL es administrador. El menu lateral lo dice, el boton de
  cerrar sesion no aparece y `/api/health` informa `modoLocal`.

### Arreglado

- **El simulador se llevaba puesto el mensaje cuando el agente no podia contestar.** Sin
  `OPENROUTER_API_KEY` cortaba antes de guardar nada, y con una clave vencida el
  proveedor devolvia 401 y la ruta terminaba en 500. En los dos casos la persona veia
  "Error" y su mensaje desaparecia de la pantalla, cuando el CRM habia hecho bien su
  parte. Ahora el mensaje entra siempre —la conversacion aparece en la bandeja y el
  contacto se crea— y la respuesta trae `agente.ok: false` con el motivo, que es lo que
  la UI ya sabia mostrar. Esto tambien pasaba en una instancia desplegada.

### Seguridad

- El modo local apaga la autenticacion entera, asi que tiene dos candados y el segundo
  es el que cuenta: hace falta `MODO_LOCAL=true`, que solo pone `npm run local`, **y**
  que `NODE_ENV` no sea `production`. Lo segundo no depende de ninguna configuracion, de
  modo que es imposible encenderlo en una imagen desplegada aunque alguien copie un
  `.env` ajeno al servidor. Hay un test que lo cubre: si se encendiera por error no
  fallaria nada y el unico sintoma seria que cualquiera entra.

### Detalles que habrian fallado en silencio

- `db.execute` devuelve el array de filas con el driver `postgres` y `{ rows }` con el
  embebido, y media docena de lugares (reportes, equipo, automatizaciones, seed) hacen
  `resultado[0]` sobre eso. Sin normalizarlo, en modo local los reportes salian en cero
  sin un solo error. Se iguala en el proxy de `src/db/index.ts`.
- `@electric-sql/pglite` resuelve sus extensiones desde la ruta de su propio archivo y el
  compilador la reescribe a `file:///ROOT/...`: va en `serverExternalPackages`.
- `DATABASE_URL` y las dos de Supabase dejan de contar como obligatorias en modo local.
  Mientras contaban, `/api/health` respondia 503 y el CRM arrancaba pero no abria.

## 1.4.3 — 2026-10-07

### Actualizar desde 1.4.2

Trae esta version. Nada que hacer: solo cambia la licencia y el README.

### Cambiado

- **Vuelve la licencia a miembros de IA Builder Lab.** 1.4.2 habia abierto el uso a
  cualquiera porque el repositorio iba a ser publico. El repositorio vuelve a ser privado,
  asi que la licencia vuelve a la version de 1.3.6: usarlo es de los miembros, mientras su
  acceso a la comunidad este vigente. El aviso MIT de auto-crm sigue en su seccion aparte,
  intacto, porque esa licencia obliga a conservarlo en los derivados.
- `package.json` vuelve a `"license": "UNLICENSED"`, y el README vuelve a presentarlo como
  lo que es: el CRM que los miembros entregan a sus clientes.

## 1.4.2 — 2026-10-06

### Actualizar desde 1.4.1

Trae esta version. Nada que hacer: solo cambia la licencia y el README.

### Cambiado

- **El repositorio es publico y la licencia lo acompana.** Hasta 1.4.1 la licencia decia
  que solo los miembros de IA Builder Lab podian usar el codigo y que no se podia publicar
  en un repositorio abierto, lo que en un repo publico se contradice solo. Ahora tiene dos
  niveles: **cualquiera** puede leerlo, clonarlo, correrlo y usarlo en su propio negocio;
  **desplegar instancias para clientes y cobrar por ellas** es de los miembros. Lo que
  sigue prohibido para todos es revenderlo o redistribuirlo como plantilla, curso o
  producto, y presentarlo como propio. Sigue siendo propietario y sigue siendo MIT lo que
  viene de auto-crm, en su seccion aparte.
- **La licencia dice que pasa con los forks.** Al estar el repositorio publicado en
  GitHub, sus terminos le permiten a cualquier usuario verlo y forkearlo dentro de la
  plataforma, y ninguna licencia puede impedirlo. Queda escrito en el punto 4 para que
  nadie lea "no redistribuir" y piense que la licencia es papel mojado al ver un fork: lo
  que se regula es para que se usa el codigo, dentro o fuera del fork.
- `package.json` declara `"license": "SEE LICENSE IN LICENSE"`, que es la forma que npm
  documenta para una licencia propia. `UNLICENSED` significaba "no le doy permiso a
  nadie", y ya no es cierto.

## 1.4.1 — 2026-10-06

### Actualizar desde 1.4.0

Trae esta version. Nada mas.

### Arreglado

- **`npm test` fallaba en un clon limpio.** Desde 1.3.4 el registro de modulos no se
  versiona (lo generan `build`, `dev` y `typecheck`), pero los tests corrian antes que
  cualquiera de los tres: en una maquina recien clonada, el archivo no existia todavia y
  el test que toca la configuracion moria con `Cannot find module`. Ahora `npm test`
  genera el registro primero, igual que `typecheck`. Lo encontro el CI en el primer
  commit con tests, que es exactamente para lo que estan.

## 1.4.0 — 2026-10-06

### Actualizar desde 1.3.6

Trae esta version. No hay migraciones ni cambios de comportamiento: entran los tests y el
CI pasa a correrlos. Si tenias un fork, `npm install` te trae vitest.

### Agregado

- **Primera suite de tests: 35 casos en 6 archivos, un segundo, sin base ni red.** No
  cubren todo a proposito: cubren los invariantes que, cuando se rompen, **no avisan**.
  - *Firma del webhook*: sin secreto rechaza (fail-closed), firma de otro secreto
    rechaza, un caracter cambiado en el cuerpo rechaza, una firma corta no revienta el
    handler, y tolera el prefijo `sha256=` de Meta.
  - *Ventana de 24 h*: adentro deja texto libre, afuera no, en el limite exacto sigue
    abierta, y sin mensaje entrante previo se considera cerrada.
  - *Filtro por rol*: el administrador es el unico sin filtro; el asesor filtra por
    `owner_id` contra su propio id (se traduce la condicion a SQL para verlo); un rol
    desconocido se trata como asesor, no como admin.
  - *Esquema de `config/cliente.ts`*: etapas repetidas, pipeline de una sola etapa, color
    que no es `#rrggbb`, clave que no es snake_case, campo de seleccion sin opciones y
    campos repetidos.
  - *Configuracion publica*: escapa `<` para que no se pueda cerrar la etiqueta `script`
    desde un valor del entorno.
  - *Plantillas de correo*: conservan los marcadores que rellena el proveedor y escapan
    el nombre de la marca.
- `npm test` y `npm run test:watch`. El CI los corre **antes** de typecheck, lint y build,
  en las dos puntas de la matriz de modulos.

### Cambiado

- `@types/node` pasa de 20 a 22, que es la version de Node que el repo pide desde el
  README. Estaban desalineados desde antes.
- `SEGURIDAD.md` explica como escanear el historial con gitleaks antes de hacer publico un
  fork, y cual es el unico hallazgo que da (un placeholder en un ejemplo de la
  documentacion).

## 1.3.6 — 2026-10-06

### Actualizar desde 1.3.5

Trae esta version. No hay migraciones ni cambios de comportamiento: cambia la licencia.

### Cambiado

- **Builder CRM pasa a ser software propietario.** Copyright de Diego Vásquez. Los
  miembros de IA Builder Lab pueden adaptarlo, desplegar instancias para sus clientes y
  cobrar por ellas; no pueden publicar el codigo ni redistribuirlo como plantilla o
  producto. Los terminos estan en `LICENSE` y el resumen en el README.
- **Se conserva el aviso MIT de auto-crm**, el proyecto del que esto nacio como fork, en
  una seccion aparte de `LICENSE`. No es cortesia: la licencia MIT permite relicenciar un
  derivado, incluso como propietario, **siempre que su aviso de copyright viaje en las
  copias**. Quitarlo seria incumplirla.
- `package.json` declara `UNLICENSED`, que es como npm nombra al software propietario.

## 1.3.5 — 2026-10-05

### Actualizar desde 1.3.4

Trae esta version y vuelve a desplegar. No hay migraciones.

### Arreglado

- **El lockfile seguia cambiando en el primer `npm install`.** 1.3.4 arreglo el numero de
  version pero no el resto: el lockfile publicado declaraba `hasInstallScript`, que sobro
  de los tiempos de SQLite, y npm lo reemplaza por `license` en cuanto alguien instala.
  Comprobado en un clon limpio: ahora el primer `npm install` deja el arbol sin cambios, y
  una adaptacion a un cliente solo muestra `config/cliente.ts` y `config/modulos.json`,
  que es lo que la constitucion promete.

## 1.3.4 — 2026-10-05

Salio de recorrer el camino de un miembro de verdad: clonar el repo publicado en una
carpeta vacia, instalar, migrar una base nueva y adaptar la plantilla a un cliente
inventado. Tres cosas no estaban como decian estar.

### Actualizar desde 1.3.3

Trae esta version y vuelve a desplegar. No hay migraciones. Despues de actualizar,
`src/lib/modules/*.generated.ts` deja de estar versionado: si tu instancia los tenia
modificados, no pasa nada, se regeneran solos al construir.

### Arreglado

- **Activar un modulo ensuciaba dos archivos del nucleo.** El registro de modulos
  (`src/lib/modules/*.generated.ts`) se genera desde `config/modulos.json`, pero estaba
  versionado, asi que cualquier adaptacion dejaba cambios dentro de `src/`: rompia la
  promesa de que `git status` solo muestra la zona del cliente y garantizaba un conflicto
  en cada actualizacion desde el repo original. Ahora esta en `.gitignore` y lo generan
  igual `next build`, `npm run dev` y `npm run typecheck`.
- **El `package-lock.json` publicado decia `1.0.0`.** Las versiones se subian a mano en
  `package.json` y el lockfile quedo atras, con un `hasInstallScript` que sobro de los
  tiempos de SQLite. Resultado: el primer `npm install` de cualquier miembro le dejaba el
  lockfile modificado sin que hubiera tocado nada. Corregido, y de ahora en mas la version
  se sube con `npm version`, que actualiza los dos archivos.
- **El runner de migraciones no explicaba los dos fallos mas probables.** Contra tu propio
  Postgres, antes de arrancar GoTrue, decia `schema "auth" does not exist` y nada mas.
  Ahora dice que corras `npm run auth:preparar`, y en el otro caso que levantes el
  contenedor de autenticacion primero. Tambien imprime los avisos del servidor en una
  linea en vez de volcar el objeto entero del driver, que parecia un error.

### Verificado en el camino

Con una base Postgres vacia y el repo recien clonado: las 5 migraciones del nucleo entran
limpias, quedan 23 tablas, **ninguna sin RLS**, 20 politicas y el rol `anon` sin un solo
privilegio. Adaptado a un cliente inventado (marca, pipeline y el modulo `visitas`
activo), la migracion del modulo entra sola y `npm run build` pasa.

## 1.3.3 — 2026-10-05

### Actualizar desde 1.3.2

Trae esta version y vuelve a desplegar. No hay migraciones. El primer despliegue tarda
como siempre (los caches nacen vacios); el siguiente tendria que ser bastante mas corto.

### Cambiado

- **El despliegue reinstalaba las 817 dependencias cada vez.** El Dockerfile copia
  `package.json` antes de `npm ci`, y cada version nueva cambia ese archivo (el numero de
  version), asi que la capa se invalidaba siempre: 4,5 minutos medidos en el VPS de la
  demo bajando y descomprimiendo lo mismo que ya estaba. Ahora `npm ci` usa un cache de
  BuildKit (`/root/.npm`), que sobrevive a la invalidacion de la capa. Se agrega tambien
  un cache para `.next/cache`: con Turbopack ayuda poco, pero no cuesta nada.
- El encabezado del `Dockerfile` ya no dice que haya que marcar variables como de build:
  desde 1.2.2 el build no necesita ninguna variable.

### Agregado

- El arnes avisa de algo que pasa en Coolify y manda a buscar problemas que no existen:
  **despues de un despliegue "completado" el contenedor viejo sigue sirviendo un rato**,
  asi que el dominio alterna las dos versiones y la verificacion mira codigo viejo la
  mitad de las veces. `probar-instancia` comprueba la version varias veces antes de
  diagnosticar, y `deploy-coolify` lo lista primero en su diagnostico.

## 1.3.2 — 2026-10-05

### Actualizar desde 1.3.1

Trae esta version y vuelve a desplegar. No hay migraciones. Si tenias el cron de
`sweepers` encendido para una instancia en Vercel, vuelve a descomentarlo (ver abajo).

### Arreglado

- **El workflow de barridos fallaba cada media hora en cada clon del repo.** Estaba
  programado cada 30 minutos y, sin los secretos configurados, el `curl` se quedaba sin
  URL (`URL rejected: No host part`). Resultado para cualquier miembro que clonara: el
  repo en rojo, un correo de fallo cada media hora y 1.440 minutos de Actions gastados al
  mes para nada. Y es un workflow que **solo hace falta en Vercel**: en Coolify los
  barridos corren dentro del proceso. Ahora viene con el cron apagado, se enciende
  descomentando dos lineas, y si se corre a mano sin secretos explica que no hay nada que
  barrer en vez de fallar.

### Cambiado

- **Ya no hay que marcar variables como "Build Variable" en Coolify.** Desde 1.2.2 la
  configuracion publica se sirve en ejecucion, asi que el paso manual que la API de
  Coolify no permite dejo de ser necesario. Lo decian el README, `.env.example`,
  `CLAUDE.md`, la skill `deploy-coolify` y `docs/SUPABASE-EN-VPS.md`, cada uno a su
  manera: los cinco quedaron corregidos. El `Dockerfile` sigue aceptando las
  `NEXT_PUBLIC_*` como build args para plataformas que las hornean.
- El diagnostico de `deploy-coolify` dice la causa real de un build que pide variables:
  codigo que consulta la base o lee el entorno al importarse.

### Agregado

- **Las dos specs que faltaban**: `specs/nucleo/08-auth-externa.md` y
  `09-correo-de-acceso.md`. Entrar con Google (1.2.0) y los correos de acceso (1.3.0) se
  construyeron sin spec previa, contra el principio II de la constitucion. Ambas lo
  declaran en el encabezado en vez de disimularlo, y con esto `specs/nucleo/` vuelve a
  describir el sistema completo, que es lo que lee Claude al adaptar una instancia.

## 1.3.1 — 2026-10-05

### Actualizar desde 1.3.0

Trae esta version y vuelve a desplegar. No hay migraciones ni pasos manuales.

### Cambiado

- **El aviso de Ajustes -> Canales mandaba a un archivo que no existe.** Decia que
  `ZERNIO_API_KEY` va en `.env.local`, que es cierto en desarrollo y falso en una
  instancia desplegada: ahi son las variables de la aplicacion. Ahora nombra los dos
  lugares, avisa que hay que volver a desplegar para que tome el valor, y en el del
  secreto del webhook recuerda que tiene que ser identico al de la suscripcion de Zernio
  y que `npm run zernio:webhook` los deja iguales.
- **Las credenciales de Zernio se leen al usarlas, no al importar el modulo.**
  `src/lib/zernio/client.ts` y `webhooks.ts` las guardaban en constantes del modulo, y
  `zernioConfig` era un objeto calculado en el primer import (ahora es una funcion). No
  habia ningun fallo en produccion, porque el contenedor arranca de nuevo en cada
  despliegue y ahi lee el entorno; es la misma forma que obligo a volver perezoso el
  cliente de base, y atarla al momento del import es una trampa esperando a que alguien
  importe el modulo desde un script o un contexto que se evalua antes de cargar el
  entorno. Quedan con el patron viejo, a proposito y documentado, `meta-whatsapp.ts` (la
  valvula de escape de Meta, que no se extiende) y `push.ts`.

## 1.3.0 — 2026-10-04

### Actualizar desde 1.2.2

Trae esta version y vuelve a desplegar. No hay migraciones. Si no configuras SMTP, nada
cambia: el alta sigue siendo con contrasena temporal, igual que hoy.

Para encender las invitaciones por correo hay que hacer dos cosas, y las dos importan:
poner el SMTP en el servidor de autenticacion y despues `AUTH_ENVIA_CORREOS=true` en el
CRM. Paso a paso con Resend, Supabase cloud y las plantillas: `docs/CORREO.md`.

### Agregado

- **Invitaciones por correo.** En Ajustes -> Equipo, el alta ahora pregunta **como
  entra**: una invitacion por correo, donde la persona elige su propia contrasena, o la
  contrasena temporal de siempre. Solo aparece si la instancia declara que su servidor de
  autenticacion manda correos.
- **Reenviar el acceso.** Un boton por miembro, para quien perdio la contrasena o nunca
  abrio la invitacion. No cambia nada hasta que la persona usa el enlace.
- **"La olvidaste?" en el login**, con su pagina: pide el correo y manda un enlace. Antes
  no habia forma de recuperar una contrasena sin que un admin la cambiara a mano.
- **Pagina para elegir la contrasena** (`/auth/definir-clave`), donde aterrizan los tres
  caminos. Guarda la sesion que viene en el fragmento de la URL y limpia la barra de
  direcciones, para que el enlace no quede en el historial ni en una captura.
- **Plantillas de correo con la marca de la instancia**, en espanol, servidas por el
  propio CRM en `/correo/invitacion.html` y `/correo/recuperacion.html`. GoTrue las
  descarga; en Supabase cloud se copian y se pegan en el panel. Si la URL no responde,
  GoTrue usa su plantilla por defecto y el correo sale igual.
- `/api/health` informa `correo: true|false`, y `npm run verificar` lo dice en la linea
  **Formas de entrar**.

### Cambiado

- El dialogo de alta ya no afirma que nunca se envia un correo: lo dice segun lo que esta
  configurado (era cierto en 1.2.2, dejo de serlo).
- `AUTH_ENVIA_CORREOS` es un interruptor manual a proposito. GoTrue sin SMTP **no falla**:
  usa un cliente de correo que se traga el mensaje y responde 200, asi que detectarlo
  automaticamente era imposible y sin el interruptor la UI diria "invitacion enviada"
  sobre un correo que nunca salio.
- `docs/SUPABASE-EN-VPS.md` corrige un consejo: `GOTRUE_MAILER_AUTOCONFIRM` se queda en
  `true` tambien con SMTP configurado, porque solo afecta al registro publico, que esta
  cerrado.

## 1.2.2 — 2026-10-04

### Actualizar desde 1.2.1

Trae esta version y vuelve a desplegar. No hay migraciones ni pasos manuales.

### Arreglado

- **El pie del menu lateral se quedaba en gris para siempre.** Next hornea las
  variables NEXT_PUBLIC durante el build, y en una instancia por cliente la URL de
  Supabase no se conoce al compilar la imagen. Encima, la API de Coolify 4.3 no permite
  marcar una variable como de build, asi que llegaban vacias al bundle: el cliente de
  Supabase del navegador nacia roto y el menu de usuario nunca cargaba, sin ningun error
  visible. Ahora el layout escribe esos dos valores publicos en un bloque JSON en tiempo
  de ejecucion y el navegador los lee de ahi, asi que la misma imagen sirve para
  cualquier instancia. Esto tambien era necesario para que funcionara el boton de entrar
  con un proveedor externo.
- El menu de usuario lee el nombre y el correo del propio CRM en vez del cliente de
  Supabase, y si la consulta falla muestra un aviso en vez de quedarse cargando.

### Cambiado

- **Ajustes -> Equipo explica que ve cada rol** al elegirlo: el asesor ve solo los
  contactos asignados a el con todo lo que cuelga de ellos, el administrador ve todo.
  El comportamiento ya era ese; lo que faltaba era decirlo donde se decide.
- El dialogo de alta aclara que **no se envia ningun correo**: la cuenta queda lista al
  instante y la contrasena temporal se la pasa el administrador, o se deja vacia si esa
  persona va a entrar con un proveedor externo.

## 1.2.1 — 2026-10-03

### Actualizar desde 1.2.0

Trae esta version y vuelve a desplegar. Si todavia no configuraste ningun proveedor
externo, no te afecta.

### Arreglado

- **La vuelta del login con un proveedor externo redirigia a la direccion interna del
  contenedor.** Detras de un proxy, el origen de la peticion es algo como
  https://0.0.0.0:3000, asi que despues de entrar con Google el navegador terminaba en
  una URL inalcanzable. Ahora la direccion publica sale de APP_BASE_URL, que es la
  fuente que no se puede falsear desde fuera, y solo si falta se miran las cabeceras
  del proxy. Encontrado probando la ruta en la instancia desplegada.

## 1.2.0 — 2026-10-03

### Actualizar desde 1.1.2

Trae esta version y vuelve a desplegar. No hay migraciones ni pasos manuales, y si no
configuras ningun proveedor externo nada cambia: el login se ve igual que hoy.

### Agregado

- **Entrar con Google, opcional y apagado de fabrica.** Si el servidor de autenticacion
  tiene el proveedor encendido, aparece el boton en el login y en el registro; si no, no
  aparece. El CRM **no tiene variables propias** para esto: le pregunta al proveedor por
  su endpoint publico `/auth/v1/settings` que tiene encendido, asi que se configura en
  un solo lugar y no hay nada que mantener sincronizado. Sirve igual para GitHub,
  Microsoft, Facebook y Apple.

  Entrar con un proveedor **no da acceso por si solo**: quien no este en
  `team_members` cae en `/sin-acceso`, igual que con email y contrasena. El proveedor
  dice quien sos; el equipo dice si entras. Paso a paso, con la configuracion de Google
  Cloud y los fallos tipicos: [docs/GOOGLE-AUTH.md](docs/GOOGLE-AUTH.md).

- La **contrasena temporal es opcional** al dar de alta a alguien en Ajustes -> Equipo.
  Si esa persona va a entrar con un proveedor externo, inventar una contrasena que nadie
  usara solo agrega ruido.

- `npm run verificar` informa las **formas de entrar** que admite la instancia.

## 1.1.2 — 2026-10-03

### Actualizar desde 1.1.1

Trae esta version y vuelve a desplegar. No hay migraciones ni pasos manuales.

### Arreglado

- **Cinco paginas no mandaban a `/sin-acceso`.** Contactos, ajustes, actividades,
  automatizaciones y plantillas son componentes de cliente, asi que resolvian la sesion
  en el navegador y se renderizaban igual para alguien con sesion de Auth pero sin fila
  en `team_members`. No se escapaba ningun dato, porque toda ruta de datos exige
  membresia y devolvia 403, pero se veia el armazon de la aplicacion en lugar del aviso.
  Ahora la puerta es la misma en todas: `layoutSoloMiembros()` para las dos primeras y
  la comprobacion dentro de `gateLayout` para las otras tres.

## 1.1.1 — 2026-10-03

### Actualizar desde 1.1.0

Trae esta version y vuelve a desplegar: la migracion corre sola al arrancar. **Si tu
instancia ya estaba publicada en internet, despues entra a Ajustes -> Equipo y desactiva
cualquier cuenta que no reconozcas**, porque el arreglo cierra la puerta hacia adelante
pero no borra a quien haya entrado antes.

### Arreglado (seguridad)

- **Cualquiera podia darse de alta y entrar como asesor.** El disparador de la base
  creaba la fila de `team_members`, activa, para todo usuario nuevo de Auth. Y el
  registro de Supabase Auth es publico por naturaleza, porque la clave anonima viaja en
  el navegador: bastaba con llamar a `/auth/v1/signup` a mano para saltarse la pagina
  de registro cerrada del CRM y entrar a la bandeja y a los contactos. Comprobado contra
  una instancia real antes y despues del arreglo.

  Ahora el disparador **solo resuelve el arranque**: la primera cuenta de la instancia
  queda como administradora y nadie mas entra solo. Un usuario de Auth sin invitacion no
  tiene fila en `team_members` y cae en `/sin-acceso`, que es lo que la documentacion
  decia desde el principio. El alta desde Ajustes -> Equipo no cambia: esa ruta siempre
  inserto la fila ella misma.

  Como defensa en profundidad, una vez creada la cuenta administradora conviene cerrar
  tambien el registro en el proveedor: `GOTRUE_DISABLE_SIGNUP=true` si lo autoalojas, o
  el interruptor de registros en el panel de Supabase cloud. `npm run admin:crear` sigue
  funcionando igual, porque usa la clave de servicio.

## 1.1.0 — 2026-10-03

### Actualizar desde 1.0.3

Trae esta version y vuelve a desplegar. Si ya pusiste la marca de tu cliente en
`config/cliente.ts` y en `public/marca/`, el merge te va a marcar conflicto en esos
archivos: **gana tu version**, como dice [ACTUALIZAR.md](ACTUALIZAR.md). No hay
migraciones.

### Cambiado

- **La plantilla viene con la marca de IA Builder Lab**: el logo de la comunidad y sus
  colores, medidos del propio logo, con el cian `#3CF5F5` en las acciones primarias y
  el carbon `#171E21` en el panel lateral y la barra del movil. Antes el valor por
  defecto era un verde generico. Para un cliente se cambia donde siempre, en la zona del
  cliente, y nada del nucleo se toca.

### Agregado

- La autoverificacion avisa cuando una instancia **sigue con la marca de la plantilla**.
  No es un fallo, porque para una demo esta bien, pero entregarle a un cliente un CRM
  con el logo de la comunidad no da ningun error por si solo y conviene verlo antes.

## 1.0.3 — 2026-10-03

### Actualizar desde 1.0.2

Trae esta version y vuelve a desplegar. Hay una migracion nueva y corre sola al
arrancar el contenedor.

### Arreglado

- **Borrar un contacto fallaba con un 500.** Las claves ajenas de `activities`,
  `deals` y `messages` hacia `contacts` estaban en NO ACTION, y todo contacto termina
  teniendo actividades, porque las escriben la ingesta, el agente y las
  automatizaciones. Es decir: el borrado chocaba siempre. La migracion
  `20261003000000_cascada_contactos.sql` pasa esas tres a ON DELETE CASCADE buscando la
  restriccion por su definicion, no por su nombre. Lo que debe sobrevivir al borrado no
  se toca: `automation_runs` y `notifications` siguen en SET NULL porque son registro.
- **La autoverificacion cargaba `.env.local` incluso para verificar una instancia
  remota**, asi que el login se intentaba contra otro Supabase y fallaba con
  "Invalid login credentials", que parece un problema de la instancia. Ahora ese archivo
  se lee solo cuando no se pasa `--url`; para una instancia remota van
  `--supabase-url` y `--anon-key`.

### Cambiado

- La autoverificacion comprueba que **el agente actue sobre el CRM** (etapa, campos,
  resumen o nombre del contacto) en lugar de exigir que mueva la etapa. Cuando mover la
  etapa lo decide el prompt de cada cliente, no el codigo, y si no dejo ningun rastro
  sigue siendo un fallo. Si no movio la etapa, se informa sin pintar rojo.

## 1.0.2 — 2026-10-03

### Actualizar desde 1.0.1

Trae esta version y vuelve a desplegar. No hay pasos manuales ni migraciones.

### Arreglado

- **La pagina de reportes no cargaba y el seed de demostracion se cortaba a mitad.**
  Las dos cosas pasaban objetos `Date` como parametro dentro de SQL crudo. Por la via
  de `db.execute(sql\`...\`)` el driver no serializa fechas: la consulta muere con
  `ERR_INVALID_ARG_TYPE` sin llegar a Postgres. Ahora los reportes mandan las fechas
  como texto ISO con cast a `timestamptz`, y el seed usa el constructor de Drizzle, que
  si conoce el tipo de cada columna. Encontrado desplegando la instancia de
  demostracion; ningun gate lo veia porque no tocan la base.

## 1.0.1 — 2026-10-03

### Actualizar desde 1.0.0

Trae esta version y vuelve a desplegar. No hay pasos manuales. Si tu instancia ya
estaba funcionando es porque tenias activos los modulos de propiedades y visitas; en ese
caso no cambia nada para ti.

### Arreglado

- **Una instancia con los modulos apagados no podia migrar.** La migracion de RLS del
  nucleo declaraba politicas sobre `visits` y `properties`, dos tablas que desde 1.0.0
  pertenecen a los modulos de visitas y propiedades. Con `config/modulos.json` en su
  valor por defecto, que es sin modulos, esas tablas no existen: `db:migrar` fallaba y
  el contenedor no llegaba a arrancar. Cada modulo ya declara su propio RLS en su
  migracion, asi que el nucleo no las nombra mas.

### Agregado

- **Modo de base de datos autoalojada**, para desplegar sin cuenta de Supabase:
  `npm run claves:supabase` genera el secreto JWT y las claves anonima y de servicio;
  `npm run auth:preparar` crea en tu Postgres los roles, el esquema `auth` y las
  funciones `auth.uid()` y companeras que Supabase cloud trae de fabrica, con el dueno
  que GoTrue necesita. La guia completa, con el orden de los pasos y los fallos tipicos,
  esta en `docs/SUPABASE-EN-VPS.md`. Hacen falta dos contenedores en lugar de los 13 del
  stack completo de Supabase, porque el CRM usa Supabase solo para autenticacion.

## 1.0.0 — 2026-10-02

Primera version para la comunidad IA Builder Lab. Nace de un CRM construido para un
cliente inmobiliario (Next.js 16 + Supabase + Zernio) y lo convierte en una plantilla
con nucleo minimo, zona del cliente y arnes de Claude Code.

### Actualizar desde…

No hay version anterior compatible: esta es la base. Las instancias del CRM de origen no
se actualizan por merge; se migran creando una instancia nueva y cargando los datos.

### Nucleo

- **Base desplegable**: migraciones canonicas en `supabase/migrations/` (base, RLS,
  primer admin) aplicadas por `scripts/migrar.mjs` (tabla `_migraciones`, transaccion
  por archivo, reintentos, RLS forzado); `src/lib/env.ts`; `/api/health` con version y
  commit; Dockerfile multi-stage con migraciones al arrancar; `docker-compose.yml`
  solo app; barridos dentro del proceso fuera de Vercel.
- **Seguridad**: RLS en todas las tablas, `anon` sin privilegios, politicas de lectura
  por rol; `requireMember` en toda ruta de datos y chequeo de propietario por
  contacto; registro publico abierto solo para la primera cuenta (admin);
  `scripts/crear-admin.mjs`.
- **Configuracion por cliente**: `config/cliente.ts` (marca, idioma, moneda, roles,
  pipeline, campos del contacto, agente, modulos) validada con zod; marca aplicada en
  SSR (CSS variables, manifest de la PWA, titulo); pipeline sincronizado por clave al
  arrancar; `contacts.custom_fields` en formulario, ficha, tabla y chat.
- **Modulos**: `modules/<nombre>/` con manifiesto, servidor (paginas, API, tools,
  seed) y migraciones; `config/modulos.json`; registro generado con imports
  estaticos; catch-all `/m/<modulo>` y `/api/m/<modulo>`; menu construido desde la
  config. Incluye `_plantilla` y `ejemplo`.
- **Conectores**: interfaz `Conector` (enviar, webhook, estado); Zernio completo,
  Meta Cloud API parcial y documentado, simulador; mecanica generica de webhooks;
  webhook de leads en `/api/webhooks/leads`.
- **Agente**: tools genericas (`mover_etapa`, `actualizar_contacto`,
  `registrar_actividad`, `resumen_lead`, `derivar_asesor`, `asignar_asesor`) mas las
  de los modulos; prompt generico con CONTEXTO y EQUIPO; cascada canal -> global ->
  config -> default; pausa por conversacion; responde solo por `deliverMessage`;
  `contacts.ai_summary`.
- **Simulador** (`/simulador`, solo admin): chatear con el agente sin canal conectado
  y ver lo que cambia en el CRM; base de la autoverificacion.
- **Reportes reales** por 7/30/90 dias y dashboard sin numeros inventados;
  `messages.origin`.
- **Datos demo** por `POST /api/seed/demo`, `npm run seed` y boton del inicio.

### Plantillas y modulos

- `config/plantillas/inmobiliaria.ts` (7 etapas, 5 campos, prompt calificador).
- `modules/propiedades` (catalogo, busqueda semantica o por filtros, Tokko opcional).
- `modules/visitas` (visitas, calendario, tool `agendar_visita`).

### Arnes

- `CLAUDE.md`, `specs/CONSTITUCION.md`, `specs/_plantilla.md`, `specs/nucleo/*`,
  `specs/inmobiliaria/spec.md`.
- Skills: `adaptar-a-cliente`, `crear-modulo`, `nueva-plantilla-nicho`,
  `deploy-coolify`, `conectar-zernio`, `probar-instancia`, `actualizar-desde-original`.
- `.mcp.json.example` + `docs/MCP.md`; `scripts/verificar-instancia.mjs`; CI.

### Quitado respecto del CRM de origen

Clasificacion con Anthropic, digest por Resend, servidor MCP sobre SQLite, slash
commands de auto-crm, experimento GoHighLevel, scripts de operacion de un cliente,
datos del cliente en el prompt, maqueta de reportes.
