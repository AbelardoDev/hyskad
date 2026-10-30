# F08 — Ventas de mostrador y comprobantes

**Rama:** `feature/f08-ventas`
**Requisitos:** Gestión de ventas (ERS §6.2), RF27 (comprobantes de venta), RF29 · RNF Confiabilidad, Rendimiento · RN-01 a RN-06, RN-18 a RN-21
**Lee antes:** `CLAUDE.md`, `docs/BUSINESS-RULES.md` §1 y §5, `docs/DESIGN-SYSTEM.md` §7 (Nueva venta, Comprobantes)

## Prompt

Ejecuta la fase F08 de HYSKAD: módulo `ventas` con punto de venta, anulación y comprobante imprimible. Muéstrame un plan corto y espera mi OK.

### Backend
- Migración: `venta`, `venta_detalle`.
- **Cálculo de totales**: crea en `shared` (o en un paquete `shared/dinero`) una clase pura `CalculadoraTotales` que implemente RN-04 y RN-05. La reutilizarán ventas, presupuestos y órdenes. Sin dependencias de Spring.
- `POST /ventas` (`VENTAS_CREAR`): cliente opcional (RN-18), ítems sin repetir, descuento, método de pago y referencia (RN-20), `montoRecibido` opcional en efectivo (debe ser ≥ total; se devuelve el cambio). Por cada ítem toma el `precio_venta` vigente (el cliente **no** envía precios), llama `InventarioService.registrarSalidaVenta` y congela precio y costo en el detalle. Numeración `V-000001`. Una sola transacción.
- `GET /ventas` (filtros: rango de fechas, cliente, vendedor, método, estado, número), `GET /ventas/{id}`.
- `POST /ventas/{id}/anulacion` (`VENTAS_ANULAR`, motivo) según RN-21. Publica `VentaAnulada`.
- `GET /ventas/{id}/comprobante`: DTO con todo lo necesario para imprimir (datos del taller desde `configuracion`, cliente, ítems, totales, IVA aplicado, vendedor, leyenda RN-06).
- Auditoría de ventas y anulaciones.

### Frontend (`features/ventas`)
- **Punto de venta** (`/ventas/nueva`), pensado para atender rápido:
  - Buscador de productos con resultados al escribir (código o nombre), mostrando precio y disponible; Enter agrega el primero; atajos de teclado documentados en un pequeño popover.
  - Carrito con cantidades editables (no deja superar el disponible), quitar ítem, descuento, cliente opcional (combobox con creación rápida que abre el formulario de cliente).
  - Totales en vivo usando la misma lógica de redondeo que el backend (un `calcularTotales` en `core/utils` con pruebas que comparan contra casos fijos del backend).
  - Método de pago con selector visual (íconos), referencia cuando aplica, y en efectivo el monto recibido con el cambio calculado en grande.
  - Confirmación → pantalla de éxito con número de venta, botón **Imprimir comprobante** y **Nueva venta**.
  - En móvil: buscador arriba y carrito como hoja inferior expandible con el total siempre visible.
- **Lista de ventas** con filtros, totales del periodo filtrado y detalle con botón de anular (solo si tiene permiso).
- **Comprobante** (`/ventas/:id/comprobante`): diseño de recibo limpio con `@media print` (sin layout de la app, tamaño carta y opción de tirilla de 80 mm), logo, leyenda de documento interno. "Imprimir / Guardar como PDF" usa `window.print()`.

### Pruebas obligatorias
CP-29, CP-30, CP-31, CP-32, CP-33, CP-34, y además:
- `CalculadoraTotales` con casos parametrizados (descuento 0, descuento igual al subtotal, IVA 0 y 19, redondeos de .5).
- Los mismos casos en el `calcularTotales` del front (deben dar idénticos resultados).
- El precio enviado por el cliente se ignora (no hay campo de precio en la petición).
- E2E: venta completa en efectivo con cambio → imprimir comprobante (verificar contenido) → anular como admin → stock restituido.

### Criterios de aceptación
- [ ] Una venta de 3 productos se puede hacer solo con teclado.
- [ ] Capturas del punto de venta (escritorio y móvil, claro y oscuro) y del comprobante.
- [ ] Todo en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. PR, CI verde, merge.
