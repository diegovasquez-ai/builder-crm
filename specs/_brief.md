# Brief del cliente — Builder CRM

Lo que Claude Code necesita saber para adaptar una instancia. Se llena antes de escribir
una sola linea: es la entrada del flujo one-shot (`adaptar-a-cliente`), y de el sale
`specs/<cliente>/spec.md`, `config/cliente.ts` y los modulos.

**Como se usa.** Copia este archivo a `specs/<cliente>/brief.md`, llenalo y abri Claude
Code en el repo:

> Adapta Builder CRM para <cliente> con el brief de specs/<cliente>/brief.md y
> desplegalo en mi Coolify.

Tambien sirve pegado en el chat sin crear el archivo.

**No hace falta llenarlo todo.** Solo las tres cosas de *Lo minimo* son obligatorias. Lo
que dejes en blanco lo decide Claude con criterio de negocio y te lo dice en el resumen
final, para que lo corrijas desde Ajustes o pidiendo el cambio. Un brief a medias y
desplegado sirve mas que un brief perfecto sin desplegar.

**Las credenciales no van aqui.** Este archivo puede terminar en un commit. Las claves
van en `.env.local` (local) o en las variables de Coolify, y nunca al repo. Si se las
pasas a Claude, pegalas en el chat, no en el archivo.

---

## Lo minimo

**1. Cliente y nicho**
Nombre tal cual se escribe, y a que se dedica en una linea.

> Ejemplo: Casa Sur, inmobiliaria que vende y arrienda departamentos en Santiago.

El nicho decide el punto de partida: si existe `config/plantillas/<nicho>.ts` se arranca
de ahi y se ajusta. Hoy existe `inmobiliaria`. Si no existe, se arma desde cero (y
despues conviene convertirlo en plantilla con `nueva-plantilla-nicho`).

**2. Dominio de la instancia**
Donde va a vivir el CRM, con el DNS ya apuntando al VPS.

> Ejemplo: crm.casasur.cl

**3. Que tiene que lograr el agente**
Dos o tres frases sobre que pasa hoy cuando entra un mensaje, y que querria el cliente
que pasara. Esto es lo que mas influye en el resultado: de aqui sale el prompt.

> Ejemplo: hoy los mensajes de WhatsApp los contesta la recepcionista cuando puede, y de
> noche no contesta nadie. Queremos que el agente responda al toque, averigue si busca
> comprar o arrendar, en que zona y con que presupuesto, agende la visita si esta listo,
> y avise a un asesor cuando el lead esta calificado.

---

## Accesos que hacen falta (se pasan por chat, no por archivo)

| Para que | Que se necesita | Sin esto |
|---|---|---|
| Base de datos | Proyecto de Supabase, o el MCP de Supabase en modo cuenta para crearlo | No hay instancia |
| Hosting | URL y token de Coolify | Se arma todo pero no se despliega |
| El agente | Clave de OpenRouter | La demo levanta sin IA: el agente no responde |
| Canales | Credenciales de Zernio | La demo funciona con el simulador; WhatsApp, Instagram y Messenger se conectan despues con `conectar-zernio` |

Los tres primeros conviene tenerlos antes de empezar. Los canales pueden esperar: una
instancia se entrega y se demuestra con el simulador.

---

## Marca

| Dato | Que es | Limite |
|---|---|---|
| Nombre | Pestana del navegador, login, sidebar | 60 caracteres |
| Nombre corto | Icono de la app en el celular y notificaciones | **12 caracteres** |
| Descripcion | Una frase, aparece en el login | 200 caracteres |
| Color primario | Botones y acciones | formato `#rrggbb` |
| Color del sidebar | Fondo de la barra lateral, y del navegador en el celular | formato `#rrggbb` |
| Logo e icono | PNG. El icono tiene que leerse en 64 px | — |

Si el cliente no dio logo ni colores, se usan los genericos y queda anotado como
pendiente. Los archivos van en `public/marca/` como `logo.png` e `icono.png`.

**Idioma** (`es` o `en`), **moneda** (codigo de tres letras: `USD`, `CLP`, `MXN`, `EUR`)
y **como se llama al rol** en pantalla: Asesor, Vendedor, Agente, Ejecutivo, Consultor.

**Zona horaria del negocio**, en formato IANA: `America/Santiago`,
`America/Mexico_City`, `America/Bogota`, `Europe/Madrid`. No es un detalle cosmetico: es
la zona con la que el agente decide que dia es hoy, y el servidor corre en UTC. Si queda
mal, el cliente que escribe a las 22:00 recibe la respuesta corrida un dia.

---

## Pipeline

Las etapas por las que pasa una operacion, **en orden**, con cual cierra ganando y cual
cierra perdiendo. Minimo dos. El agente mueve el contacto entre estas etapas, asi que
tienen que ser las reales del negocio, no las de un manual.

> Ejemplo: Nuevo lead → Calificado → Visita agendada → Visita realizada → Negociacion →
> Cerrado ganado (ganada) → Cerrado perdido (perdida)

Si no sabes, se usa el pipeline de la plantilla del nicho y se ajusta despues arrastrando
en pantalla.

---

## Datos a averiguar de cada lead

Los campos propios del negocio: lo que un vendedor necesita saber antes de llamar. Por
cada uno:

- **Etiqueta**: como se ve en la ficha ("Presupuesto maximo").
- **Tipo**: `texto`, `numero`, `seleccion`, `booleano` o `fecha`.
- **Opciones**: obligatorias si es `seleccion` ("Compra" / "Arriendo").
- **Lo pregunta el agente?** Si si, en que palabras lo tiene que averiguar. Eso es lo que
  lee el modelo, asi que mejor "presupuesto maximo en pesos" que "presupuesto".
- **Va como columna en la tabla de contactos?** Dos o tres campos, no diez.

> Ejemplo: Tipo de operacion (seleccion: Compra / Arriendo, lo pregunta el agente, en
> tabla) · Zona (texto, lo pregunta el agente: barrio o comuna donde busca, en tabla) ·
> Presupuesto (numero, lo pregunta el agente: presupuesto maximo en UF) · Dormitorios
> (numero, lo pregunta el agente) · Credito preaprobado (booleano, no lo pregunta el
> agente: lo carga el asesor)

Regla practica: entre tres y seis campos que el agente averigua. Mas que eso y la
conversacion se vuelve un interrogatorio.

---

## El agente

- **Como se presenta**: nombre, y si dice que es un asistente virtual o no.
- **Tono**: formal o cercano, usted o tu, largo o telegrafico. Una frase de ejemplo
  escrita como hablaria el cliente ayuda mas que tres adjetivos.
- **Que SI puede hacer**: dar precios, agendar, mandar fichas, cotizar.
- **Que NO puede hacer nunca**: prometer descuentos, dar plazos de entrega, opinar de la
  competencia, hablar de la obra en construccion.
- **Cuando pasa a una persona**, y que le dice al cliente mientras espera.
- **Horario**: contesta siempre, o fuera de horario avisa que responde al dia siguiente.

Lo que el agente **no** debe inventar conviene escribirlo explicito. Es la parte del
prompt que mas problemas evita.

---

## Modulos

Contactos, conversaciones, pipeline, actividades, plantillas, reportes y simulador ya
vienen. Un modulo se agrega cuando el negocio maneja **cosas** que el CRM tiene que
listar y que el agente tiene que poder consultar.

Ya construidos: `propiedades`, `visitas`.

Por cada modulo nuevo: que cosa lista (propiedades, pedidos, citas, cursos), que datos
tiene cada una, y que tendria que poder hacer el agente con eso ("buscar propiedades por
zona y presupuesto y mandar hasta tres").

Si no estas seguro de que haga falta un modulo, no lo pidas: un campo personalizado
alcanza casi siempre, y un modulo de mas es codigo que hay que mantener en cada
actualizacion del nucleo.

**Si hace falta agendar citas o visitas**, tres preguntas mas, porque cambian como se
construye:

1. El agente **cierra** el horario ("te espero el jueves a las 16:00") o **propone** y
   una persona confirma? Lo segundo es mucho mas barato y se siente casi igual de rapido.
2. Que dias y en que horario se atiende, y cuanto dura una cita.
3. El asesor mantiene su propia agenda (Google Calendar, Outlook) con otras cosas? Si la
   respuesta es si y el agente cierra horarios, va a pisar compromisos que el CRM no ve,
   y hay que decidir si se lee su calendario o si se reserva una franja fija para citas.

---

## Datos del cliente para la demo

Que cargar para que la demo se vea real: catalogo de propiedades, lista de servicios con
precios, nombres del equipo. Si no hay nada, se usan los datos de demostracion
(`npm run seed`), que son inventados y estan marcados como tales.

**Nunca datos reales de personas** en seeds, specs ni commits.

---

## Fuera de alcance

Lo que el cliente pidio y se decidio **no** hacer en esta instancia, y por que. Esta
seccion evita la discusion de la entrega: queda escrito que se dejo afuera a proposito.

---

## Lo que pasa despues de pegar el brief

1. Claude pregunta **como maximo tres cosas**, todas juntas, y solo si falta algo
   critico.
2. Escribe `specs/<cliente>/spec.md` y te la deja para revisar.
3. Configura, construye los modulos, despliega en Coolify y **prueba la instancia
   desplegada** con `probar-instancia`. No se entrega con checks en rojo.
4. Te entrega la URL, el acceso de demo, que se construyo, que quedo pendiente y las
   decisiones que tomo solo.

Lo que no te guste se corrige despues: marca, etapas y campos se cambian en
`config/cliente.ts`, y el prompt del agente desde Ajustes → Agente sin tocar codigo.
