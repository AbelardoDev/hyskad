# F09B — Órdenes: servicios, repuestos y presupuestos

**Rama:** `feature/f09b-items-presupuestos`
**Requisitos:** RF15, RF19, RF22, RF23, RF24 · IU8 · RNF Confiabilidad, Integridad · RN-28 a RN-34
**Lee antes:** `CLAUDE.md`, `docs/BUSINESS-RULES.md` §6.1, §6.3 y §6.4, Javadoc de `InventarioService`, `CalculadoraTotales`

## Prompt

Ejecuta la fase F09B de HYSKAD: ítems de la orden (servicios y repuestos con reserva de stock), cálculo de totales y presupuestos con aprobación/rechazo. Muéstrame un plan corto y espera mi OK.

### Backend
- Migración: `orden_servicio`, `orden_repuesto`, `presupuesto`, `presupuesto_item`, y columnas de totales en `orden_trabajo` si faltan.
- **Ítems** (RN-28, RN-29, RN-30), solo en `EN_DIAGNOSTICO` y con `ORDENES_TRABAJAR` (mecánico solo si está asignado):
  - `POST /ordenes-trabajo/{id}/servicios` (de catálogo con precio editable, o mano de obra libre), `PUT` y `DELETE /ordenes-trabajo/{id}/servicios/{itemId}`.
  - `POST /ordenes-trabajo/{id}/repuestos` `{productoId, cantidad}` → `InventarioService.reservar`; editar cantidad ajusta la reserva por la diferencia; `DELETE` libera. Si el mismo producto ya está en la orden, se suma la cantidad en el mismo ítem.
  - Tras cada cambio se recalculan los totales de la orden con `CalculadoraTotales` (RF24) y la respuesta devuelve la orden con totales actualizados.
- **Presupuestos** (`PRESUPUESTOS_GESTIONAR`):
  - `POST /ordenes-trabajo/{id}/presupuestos` `{descuento, observaciones}`: exige diagnóstico y ≥ 1 ítem; congela los ítems en `presupuesto_item`, numera `P-000001` con `version`, marca anteriores pendientes como `REEMPLAZADO` (RN-31), y transiciona la orden a `PENDIENTE_APROBACION`. Publica `PresupuestoEnviado`.
  - `POST /presupuestos/{id}/decision` `{decision: APROBADO|RECHAZADO, observaciones}` (RN-33): aprobado → orden `EN_REPARACION`; rechazado → orden `CANCELADA` + liberar **todas** las reservas. Publica `PresupuestoDecidido`.
  - `POST /presupuestos/{id}/retiro` → presupuesto `REEMPLAZADO` y orden a `EN_DIAGNOSTICO`.
  - `GET /ordenes-trabajo/{id}/presupuestos` (todas las versiones) y `GET /presupuestos/{id}` (documento imprimible).
- Completa en `OrdenTrabajoService` los efectos de las transiciones que dependen de ítems:
  - `EN_REPARACION → EN_DIAGNOSTICO` ("requiere ajuste", nota obligatoria).
  - `EN_REPARACION → FINALIZADA`: `InventarioService.consumirReserva` para cada repuesto; guarda `fecha_finalizacion`. Publica `OrdenFinalizada`.
  - Cancelación desde cualquier estado activo libera reservas.
- Todo en transacciones; si falla cualquier ítem al finalizar, no se descuenta nada.
- Auditoría de cada cambio de ítems, presupuestos y decisiones.

### Frontend
- Pestaña **Servicios y repuestos** del detalle:
  - Dos secciones (servicios y repuestos) con tablas editables en línea cuando el estado lo permite; en otros estados, solo lectura con un aviso explicando por qué.
  - Agregar repuesto: combobox de productos mostrando **disponible** en vivo y precio; aviso si queda bajo el mínimo.
  - Agregar servicio: desde catálogo (precio sugerido editable) o mano de obra libre.
  - Panel de totales fijo (subtotal, descuento, IVA, total).
  - Vista del mecánico en móvil: botones grandes "Agregar repuesto" / "Agregar servicio" que abren una hoja inferior con búsqueda.
- Pestaña **Presupuestos**: botón "Enviar presupuesto" (con descuento y observaciones, y vista previa), lista de versiones con estado, y para la versión pendiente botones **Aprobar** / **Rechazar** / **Retirar** con confirmación. Vista imprimible del presupuesto (mismo estilo que el comprobante de venta).
- La línea de tiempo y las acciones del encabezado reflejan los nuevos estados.

### Pruebas obligatorias
CP-40, CP-41, CP-42, CP-43, CP-44, CP-45, CP-46, y además:
- Editar cantidad de un repuesto de 2 a 5 y luego a 1 → reservas correctas en cada paso.
- Cancelar una orden con 3 repuestos reservados → todas las reservas liberadas.
- Intentar desactivar un producto que está reservado en una orden → 409 (RN-15).
- Mecánico no asignado intenta agregar ítem → 404.
- E2E: flujo diagnóstico → agregar 1 servicio y 2 repuestos → enviar presupuesto → aprobar → finalizar → verificar stock en el módulo de inventario.

### Criterios de aceptación
- [ ] El total del presupuesto aprobado siempre coincide con el total de la orden (prueba dedicada).
- [ ] Capturas de la pestaña de ítems (escritorio y móvil del mecánico) y de presupuestos, en claro/oscuro.
- [ ] Todo en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. PR, CI verde, merge.
