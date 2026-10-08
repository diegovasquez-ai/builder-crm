# Modo local: correr el CRM sin crear una cuenta en ningun lado

Escrita antes del codigo: **no**. Salio de ver el problema en vivo: al mostrar el repo
en una clase, `npm run dev` sobre un clon recien hecho no abria ninguna pagina y pedia
crear un proyecto en Supabase.

## Problema

Quien clona el repo para mirarlo —un miembro nuevo, alguien evaluandolo, el propio
dueno en una clase— no puede ver el CRM funcionando sin antes crear un proyecto de
Supabase, copiar cuatro variables y correr las migraciones.

Y no es que se vea a medias: no se ve nada. `src/lib/supabase/middleware.ts` arma el
cliente con `process.env.NEXT_PUBLIC_SUPABASE_URL!`, asi que sin esa variable **toda**
peticion muere antes de renderizar. El sintoma es una pantalla de error, no un aviso
util.

Ese paso es donde se pierde a la mayoria. El CRM es el corazon del modulo de la
comunidad: la primera leccion no puede empezar con "crea una cuenta en Supabase".

## Escenarios

1. Alguien clona el repo, corre `npm install && npm run local` y en menos de dos
   minutos tiene el CRM abierto con contactos, conversaciones, pipeline y reportes.
2. Edita `config/cliente.ts` (marca, pipeline, campos), recarga y ve el cambio, sin
   tocar ninguna base remota.
3. Abre el simulador, escribe un mensaje y lo ve entrar a la bandeja con su contacto
   creado, aunque no tenga clave de OpenRouter.
4. Agrega `OPENROUTER_API_KEY` a `.env.local` y ahora el agente le contesta.
5. Cuando quiere una instancia de verdad, sigue el camino de siempre (Supabase +
   Coolify) sin desarmar nada de lo anterior.

## Requisitos

- **FR-1** `npm run local` no debe exigir ninguna cuenta, servicio ni variable de
  entorno. Node y npm es todo.
- **FR-2** La base local aplica **las mismas migraciones** que una instancia
  desplegada, RLS incluido. Si el esquema local y el real divergieran, el modo local
  dejaria de servir para probar nada.
- **FR-3** El administrador de la demo se da de alta por el **mismo camino que en
  produccion**: insertar en `auth.users` y dejar que el disparador del primer admin
  cree la fila en `team_members`.
- **FR-4** Sin servidor de autenticacion no hay sesion: quien abre la URL es
  administrador. La UI tiene que decirlo en todo momento.
- **FR-5** El modo local es **imposible** en produccion, aunque la variable este
  puesta.
- **FR-6** Las variables que no existen en modo local (`DATABASE_URL` y las dos de
  Supabase) no cuentan como faltantes: si no, `/api/health` responde 503 y el CRM no
  abre.
- **FR-7** Lo que el modo local no puede dar se dice en voz alta, no se simula: login,
  equipo, correos y busqueda semantica de propiedades.

## Decisiones

**Postgres embebido, no Docker.** `@electric-sql/pglite` es Postgres compilado a
WebAssembly y se instala como un paquete de npm. La alternativa (Docker con Postgres y
GoTrue) es mas fiel —habria login de verdad— pero exige instalar Docker Desktop, que es
justo el punto donde se cae la gente en una clase en vivo. La fidelidad se recupera en
el paso siguiente, cuando se despliega.

**Sin login, no con un login falso.** Un login de mentira seria mas parecido a la foto
final y mucho peor: daria la sensacion de que hay autorizacion donde no hay ninguna.
Mejor que se vea que no hay sesion.

**Dos candados, y el que cuenta es el segundo.** `MODO_LOCAL=true` lo pone solo
`npm run local`; pero una variable se filtra facil (alguien copia su `.env.local` al
servidor). Por eso ademas hace falta que `NODE_ENV` no sea `production`, cosa que no
depende de ninguna configuracion: `next build` + `next start` y la imagen de Docker
corren en production siempre.

**pgvector queda afuera.** El Postgres embebido no lo trae. Solo lo usa el modulo
`propiedades` para la busqueda por significado: la migracion se saltea con un aviso y
el resto del modulo anda.

## Fuera de alcance

- Login, equipo e invitaciones en modo local.
- Webhooks reales (Zernio necesita una URL publica).
- Usar la base local para algo que no sea probar y adaptar.

## Como se verifica

Clonar el repo en una carpeta limpia **sin `.env.local`**, `npm install`,
`npm run local`, y comprobar: las cinco migraciones aplicadas, `/api/health` en 200 con
`modoLocal: true`, las paginas principales en 200, los reportes con numeros reales (no
en cero, que es como se veria si `db.execute` no estuviera normalizado) y un mensaje
por el simulador que entra a la bandeja sin clave de OpenRouter.
