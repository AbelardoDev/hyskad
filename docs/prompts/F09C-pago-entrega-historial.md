# F09C — Órdenes: pago, entrega, comprobante, historial y vista del mecánico

**Rama:** `feature/f09c-pago-entrega`
**Requisitos:** RF9, RF25, RF26, RF27, RF28 · IU6, IU8 · RN-35, RN-36, RN-37
**Lee antes:** `CLAUDE.md`, `docs/BUSINESS-RULES.md` §6.5, `docs/DESIGN-SYSTEM.md` §7 (vista del mecánico, comprobantes)

## Prompt

Ejecuta la fase F09C de HYSKAD: cierre del ciclo de la orden (pago y entrega), comprobante, historial de la moto, cuentas pendientes y la experiencia móvil del mecánico. Muéstrame un plan corto y espera mi OK.

### Backend
- Migración: `pago` (UQ por orden) y columnas de entrega si faltan.
- `POST /ordenes-trabajo/{id}/pago` (`PAGOS_REGISTRAR`): solo en `FINALIZADA`, monto exactamente igual al total (RN-35), método y referencia como RN-20, `montoRecibido` opcional en efectivo.
- `POST /ordenes-trabajo/{id}/entrega` (`ENTREGAS_REGISTRAR`): exige pago (RN-36), guarda fecha, usuario y observaciones, transiciona a `ENTREGADA`, publica `OrdenEntregada`.
- `GET /ordenes-trabajo/{id}/comprobante`: DTO imprimible (taller, cliente, moto, kilometraje, diagnóstico resumido, servicios, repuestos, totales, pago, mecánicos, leyenda RN-06).
- `GET /motocicletas/{id}/historial` (RF9) ahora real: órdenes de la moto (excepto canceladas, con opción `incluirCanceladas`), con fecha, kilometraje, diagnóstico, servicios, repuestos, total y mecánicos; paginado y ordenado por fecha descendente.
- `GET /reportes/cuentas-pendientes` (RF26, RN-37): filtros por cliente y rango de fechas; total adeudado del resultado.
- Auditoría de pagos y entregas.

### Frontend
- Pestaña **Pago y entrega**: resumen del total, formulario de pago (igual al del punto de venta: métodos con íconos, cambio en efectivo), luego formulario de entrega; al terminar, pantalla de éxito con botón para imprimir el comprobante.
- **Comprobante de orden** imprimible (mismo diseño base que el de venta).
- **Historial de la moto** en el detalle de la motocicleta: línea de tiempo vertical, cada entrada expandible con el detalle; kilometraje mostrado como progresión.
- **Cuentas pendientes**: página con tabla, días transcurridos con color según antigüedad (≤ 3 días neutro, ≤ 7 advertencia, > 7 peligro) y acceso directo a registrar el pago.
- **Vista del mecánico** (`/taller/mis-ordenes`), diseñada para celular primero:
  - Tarjetas grandes por orden con placa estilizada, moto, motivo, estado y tiempo transcurrido; agrupadas por estado ("Por diagnosticar", "Esperando aprobación", "En reparación").
  - Dentro de la orden, acciones primarias grandes y fijas abajo según `accionesPermitidas` (p. ej. "Iniciar diagnóstico", "Finalizar reparación").
  - Funciona cómodo con una mano: nada importante arriba a la izquierda, botones ≥ 48 px.
  - Esta es la página de inicio por defecto para el rol MECANICO.

### Pruebas obligatorias
CP-21 (ahora real), CP-47, CP-48, CP-49, CP-50 (E2E completo con tres usuarios: vendedor recibe, mecánico diagnostica y repara, vendedor presupuesta/cobra/entrega), CP-51, y además:
- Pago en estado distinto de `FINALIZADA` → 409; segundo pago → 409.
- Historial excluye canceladas por defecto.

### Criterios de aceptación
- [ ] El flujo CP-50 pasa en el CI (job e2e).
- [ ] Capturas de la vista del mecánico en 375 px (claro y oscuro), del historial y del comprobante.
- [ ] Todo en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. PR, CI verde, merge.
