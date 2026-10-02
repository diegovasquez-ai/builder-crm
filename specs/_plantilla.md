# Spec: <nombre corto de la funcionalidad o del cliente>

> Copiar este archivo a `specs/<cliente>/spec.md` (adaptacion de un cliente) o a
> `specs/nucleo/NN-nombre.md` (cambio en el nucleo). Borrar las notas en cursiva.
> Una spec se escribe ANTES del codigo. Si se escribio despues, decirlo en el encabezado:
> es documentacion, no diseno.

**Carril**: completo | ligero — *completo si toca el modelo de datos, un contrato publico
(API, webhook, interfaz de conector) o el nucleo; ligero si es config, modulo o UI.*
**Estado**: borrador | aprobada | implementada
**Fecha**: AAAA-MM-DD
**Escrita antes del codigo**: si | no

## Problema

*Que necesita el cliente o el nucleo, en dos o tres frases. Que pasa hoy si no se hace.*

## Decisiones del dueno

*Respuestas a las preguntas que hubo que hacer antes de empezar (maximo 3 por brief).
Numeradas D1, D2... para poder citarlas.*

## Escenarios

*Como se usa, con verbos. Uno por linea, numerados. Cada escenario tiene que ser
observable: alguien lo puede probar sin leer codigo.*

1. **Recibir** — ...
2. **Responder** — ...

## Requisitos

*Lo que el sistema DEBE hacer. Numerados FR-001, FR-002... Si algo no esta claro,
marcarlo `[PENDIENTE: pregunta]` en vez de inventar.*

- FR-001 El sistema DEBE ...
- FR-002 ...

## Configuracion y modulos

*Que cambia en `config/cliente.ts` (marca, pipeline, campos, modulos activos) y que
modulos nuevos se crean en `modules/`. Si no toca config ni modulos, decir "ninguno".*

## Modelo de datos

*Tablas o columnas nuevas, con su migracion. Las tablas de un modulo viven en
`modules/<modulo>/migrations/`. Si no toca datos, decir "ninguno".*

## Agente de IA

*Prompt, campos a calificar y tools nuevas. Si no cambia, decir "sin cambios".*

## Criterios de aceptacion

*Lo que verifica `probar-instancia` (o una persona) para dar la spec por cumplida.
Numerados CA-001... Cada uno tiene que poder ponerse en rojo o verde.*

- CA-001 ...

## Constitution Check

*Una linea por principio de `specs/CONSTITUCION.md`: cumple / no aplica / excepcion
justificada.*

- I. Nucleo intocable: ...
- II. Spec antes que codigo: ...
- III. Autoverificacion: ...
- IV. Cero secretos: ...

## Fuera de alcance

*Lo que se decidio NO hacer, y por que. Evita que se vuelva a discutir.*
