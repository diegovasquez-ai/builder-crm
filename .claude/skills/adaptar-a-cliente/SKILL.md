---
name: adaptar-a-cliente
description: |
  Del brief de un cliente a una instancia de Builder CRM adaptada, desplegada y probada,
  en un solo flujo: entender, especificar, configurar, construir modulos, desplegar en
  Coolify, probar y entregar. Es la skill orquestadora del flujo one-shot.
  Activar cuando el usuario dice: adapta el CRM para <cliente>, nuevo cliente, quiero un
  CRM para una <nicho>, personaliza Builder CRM, despliega una instancia para <cliente>,
  o pega un brief de cliente.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill
---

# Adaptar Builder CRM a un cliente

> Entrada: $ARGUMENTS (brief, prompt o nombre del cliente)

Tu trabajo termina con una **URL funcionando**, credenciales de demo y un resumen. No
termina con "listo para desplegar". Sigue los pasos en orden; cada paso deja un commit.

## 0. Reglas que no se negocian

- **Nunca edites el nucleo** (`src/`, `supabase/`, `scripts/`, Docker). Todo va en
  `config/`, `modules/`, `public/marca/`, `specs/<cliente>/`. Si crees que hace falta
  tocar el nucleo, para y explicalo: es una mejora para el repo original.
- Secretos solo en `.env.local` (local) y en las variables de Coolify. Nada en el repo.
- Cero datos reales en seeds, specs o commits.
- Si el repo tiene `.claude/memory/`, lee `MEMORY.md` antes de empezar.

## 1. Entender (maximo 3 preguntas, todas juntas)

Lee el brief y resuelve con sentido comun. Pregunta SOLO si falta algo critico y
agrupa las preguntas en un unico mensaje. `specs/_brief.md` es el cuestionario completo:
si el brief viene muy flaco, pasale ese archivo al miembro en vez de interrogarlo por
chat. Lo tipico que hace falta:

1. **Nombre del cliente y nicho** (inmobiliaria, clinica, tienda...). Si existe
   `config/plantillas/<nicho>.ts`, parte de ahi.
2. **Dominio** para la instancia (`crm.cliente.com`, con DNS apuntando al VPS) y
   acceso a **Coolify** (URL + token) y a **Supabase** (MCP en modo cuenta, o un
   proyecto ya creado). Sin esto se puede hacer todo menos desplegar.
3. **Clave de OpenRouter** (si no, el agente no responde y la demo queda sin IA).

No preguntes por canales (Zernio): se conectan despues con `conectar-zernio`.

## 2. Especificar

Copia `specs/_plantilla.md` a `specs/<cliente>/spec.md` y completala: problema,
decisiones del dueno (las respuestas del paso 1), escenarios, requisitos, configuracion
(marca, pipeline, campos, modulos), modelo de datos (solo tablas de modulos), agente
(prompt, campos a calificar), criterios de aceptacion. Carril ligero salvo que haya
modulos con tablas nuevas. Commit: `Spec de <cliente>`.

## 3. Configurar (zona del cliente)

1. `config/cliente.ts`: `definirConfig({ ...plantilla, marca: {...}, ... })` o desde
   cero. Marca (nombre, nombreCorto, descripcion, colorPrimario, colorSidebar),
   `idioma`, `moneda`, `roles.etiquetaAsesor`, `pipeline.etapas` (clave snake_case,
   nombre, color, ganada/perdida), `contacto.campos` (con `agente.descripcion` en los
   que el agente deba averiguar), `agente` (nombre, prompt, mensajeDerivacion).
2. `config/modulos.json`: `{ "activos": [...] }` con los modulos que la spec pide.
3. `public/marca/logo.png` e `icono.png` (si el cliente los dio; si no, deja los
   genericos y anotalo en el resumen). `npm run pwa:icons`.
4. Verifica: `npm run typecheck && npm run lint && npm run build`. Commit:
   `Configuracion de <cliente>`.

## 4. Construir modulos

Por cada modulo nuevo que pida la spec, invoca la skill `crear-modulo`. Los que ya
existen (`modules/propiedades`, `modules/visitas`, `modules/ejemplo` como referencia)
solo se activan. Commit por modulo.

## 5. Desplegar

Invoca `deploy-coolify`. Resultado esperado: proyecto Supabase con migraciones
aplicadas, cuenta admin de demo creada, app en Coolify respondiendo `/api/health`
con `ok: true`, datos demo cargados (`npm run seed -- --url https://...`).

## 6. Conectar canales (opcional ahora)

Si el cliente ya tiene credenciales de Zernio, invoca `conectar-zernio`. Si no, deja
instrucciones en el resumen: la demo funciona con el simulador.

## 7. Probar

Invoca `probar-instancia` contra la URL desplegada. Si algo falla: diagnostica,
corrige, redespliega y vuelve a probar. No entregues con checks en rojo; si uno no se
puede cumplir (por ejemplo falta OpenRouter), dilo explicitamente.

## 8. Entregar

Un mensaje con:
- **URL** de la instancia y `/api/health`.
- **Acceso demo**: email y contrasena del admin creado (pedir cambiarla).
- **Que se construyo**: marca, etapas, campos, modulos, prompt del agente (resumen).
- **Como seguir**: conectar WhatsApp/IG/Messenger (`conectar-zernio`), cargar
  catalogo real, ajustar el prompt desde Ajustes -> Agente.
- **Pendientes y decisiones** que tomaste solo.
- Tiempo total del flujo.

Guarda en `.claude/memory/` lo no obvio del cliente (skill `memory-manager`).
