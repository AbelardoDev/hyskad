# F09A — Órdenes de trabajo: creación, asignación, estados y diagnóstico

**Rama:** `feature/f09a-ordenes-base`
**Requisitos:** RF10, RF11, RF12, RF13, RF14, RF16, RF29 · IU8 · RNF Trazabilidad · RN-22 a RN-27, RN-44
**Lee antes:** `CLAUDE.md`, `docs/BUSINESS-RULES.md` §6.1 y §6.2, `docs/ARCHITECTURE.md` §3 (taller) y §6 (máquina de estados), `docs/DESIGN-SYSTEM.md` §1.3 y §7 (tablero y detalle de orden)

## Prompt

Ejecuta la fase F09A de HYSKAD: catálogo de servicios del taller y el núcleo de las órdenes de trabajo. Muéstrame un plan corto y espera mi OK.

### Backend
- Migración: `servicio`, `orden_trabajo` (con `version`), `orden_mecanico`, `orden_estado_historial`. Índices por estado, fecha de ingreso, cliente y moto.
- **Módulo `servicios`** (RF16, `SERVICIOS_GESTIONAR`): CRUD del catálogo (nombre único, precio base > 0, tiempo estimado en minutos). Datos de desarrollo: 12 servicios típicos (cambio de aceite, sincronización, frenos, kit de arrastre, revisión eléctrica...).
- **`EstadoOrden`** como máquina de estados (`ARCHITECTURE.md` §6): el enum declara sus transiciones permitidas; `OrdenTrabajo.transicionarA(nuevo, usuario, nota)` valida, aplica y registra el historial. Los **efectos** de cada transición (validar diagnóstico, reservas, inventario) los orquesta `OrdenTrabajoService`, no el enum. En esta fase implementa las transiciones y condiciones que no dependen de ítems ni presupuestos; deja preparadas las demás con su validación de condición (lanzan `TRANSICION_INVALIDA` si la condición no se cumple).
- `OrdenTrabajoService`:
  - Crear (RN-25, RN-24). Numeración `OT-000001`. Estado `RECIBIDA`.
  - Editar datos de recepción (motivo, descripción, observaciones) mientras no esté en estado final.
  - Asignar/quitar mecánicos (RN-26) con actividad descriptiva.
  - Registrar/editar diagnóstico (RF14): diagnóstico, observaciones, kilometraje de inspección (≥ ingreso).
  - Transiciones vía `POST /ordenes-trabajo/{id}/transiciones` `{estado, nota}`; cancelación exige nota.
  - Seguridad por fila (RN-27): un mecánico solo obtiene y opera sus órdenes; si no está asignado responde **404**.
- Implementa `ConsultaOrdenesActivas` (de F05) y elimina la implementación por defecto; quita esa deuda de `PROGRESS.md`.
- Endpoints: `POST/GET /ordenes-trabajo` (filtros: texto —número, placa, cliente—, estado(s), mecánico, rango de fechas), `GET /ordenes-trabajo/mias`, `GET /ordenes-trabajo/{id}` (detalle completo con cliente, moto, mecánicos, historial de estados y **acciones permitidas** para el usuario actual), `PUT /{id}`, `PUT /{id}/mecanicos`, `PUT /{id}/diagnostico`, `POST /{id}/transiciones`, `GET /ordenes-trabajo/resumen-estados` (conteo por estado para el tablero).
- Calcula `accionesPermitidas` en el backend (según estado + permisos + asignación) para que el front no duplique esas reglas.
- Publica eventos: `OrdenCreada`, `MecanicoAsignado`, `EstadoOrdenCambiado` (aún sin listeners).
- Auditoría de creación, edición, asignaciones, diagnóstico y transiciones.

### Frontend (`features/taller`, `features/servicios`)
- **Catálogo de servicios**: lista y formulario.
- **Recepción de moto / nueva orden**: flujo en pasos (`hk-stepper`): 1) buscar cliente (o crearlo) 2) elegir o registrar moto (muestra la última lectura de kilometraje) 3) datos de ingreso 4) asignar mecánicos (opcional) 5) confirmar. Advierte si la moto ya tiene orden activa con enlace a ella.
- **Tablero de órdenes**: vista lista (tabla con número, placa estilizada, cliente, mecánicos como avatares, estado, fecha y antigüedad) y vista **kanban** por estado con contadores; filtros persistidos en la URL. En móvil, lista de tarjetas.
- **Detalle de orden**: encabezado (número, placa, cliente, moto, estado), línea de tiempo de estados, botones de acción según `accionesPermitidas` (con confirmación y nota cuando aplica), pestañas *Resumen*, *Diagnóstico* (formulario) e *Historial*; las pestañas de ítems, presupuestos y pago aparecen deshabilitadas con "Disponible pronto" hasta F09B/C.
- Badges de estado exactamente como `DESIGN-SYSTEM.md` §1.3.

### Pruebas obligatorias
CP-35, CP-36, CP-37, CP-38 (parametrizada con **todas** las combinaciones origen/destino), CP-39, CP-19 (ahora real), y además:
- Historial de estados guardado en cada transición con usuario y nota.
- `accionesPermitidas` correctas para admin, vendedor y mecánico (asignado y no asignado).
- Conflicto de concurrencia: dos ediciones con la misma `version` → la segunda recibe 409.
- E2E: recepción completa de una moto → asignar mecánico → el mecánico inicia sesión, ve solo esa orden en "Mis órdenes", registra diagnóstico.

### Criterios de aceptación
- [ ] Diagrama de estados (Mermaid) agregado a `docs/ARCHITECTURE.md` generado a partir del enum real.
- [ ] Capturas de recepción, tablero (lista y kanban) y detalle en claro/oscuro y móvil.
- [ ] Todo en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. PR, CI verde, merge.
