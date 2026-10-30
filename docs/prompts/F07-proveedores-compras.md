# F07 — Proveedores y compras

**Rama:** `feature/f07-compras`
**Requisitos:** RF20, RF21 · RNF Integridad, Confiabilidad · RN-07, RN-16, RN-17, RN-40
**Lee antes:** `CLAUDE.md`, `docs/BUSINESS-RULES.md` §2 y §4, Javadoc de `InventarioService`

## Prompt

Ejecuta la fase F07 de HYSKAD: módulos `proveedores` y `compras`, backend y frontend, usando `InventarioService` para las entradas de stock. Muéstrame un plan corto y espera mi OK.

### Backend
- Migración: `proveedor`, `compra`, `compra_detalle`.
- **Proveedores**: CRUD siguiendo la plantilla de módulo; documento validado con `@DocumentoValido` (normalmente NIT); permiso `PROVEEDORES_GESTIONAR`.
- **Compras** (`COMPRAS_GESTIONAR`):
  - `POST /compras`: proveedor activo, número de factura del proveedor, fecha (no futura), ítems (producto activo, cantidad > 0, costo unitario ≥ 0, sin productos repetidos). Calcula subtotal, IVA (configuración vigente, RN-03) y total. Numeración `C-000001`. Por cada ítem llama `InventarioService.registrarEntradaCompra`. Todo en **una** transacción: si un ítem falla, no se guarda nada.
  - `GET /compras` (filtros: proveedor, rango de fechas, estado, número), `GET /compras/{id}`.
  - `POST /compras/{id}/anulacion` con motivo (RN-17).
- Auditoría de compras y anulaciones.

### Frontend (`features/proveedores`, `features/compras`)
- Proveedores: lista, formulario y detalle con sus compras.
- **Nueva compra**: proveedor (combobox), datos de factura, tabla editable de ítems (agregar producto con combobox que muestra stock y costo promedio actual, cantidad, costo), totales en vivo y confirmación con resumen. Advertencia visual si el costo ingresado difiere más de un 30 % del costo promedio actual.
- Lista de compras con filtros y detalle con los ítems, el efecto en el stock y el botón de anular (con motivo y confirmación).

### Pruebas obligatorias
CP-23 (de punta a punta vía compra), CP-27, CP-28, y además:
- Compra con un producto inactivo entre varios → 400 y ningún cambio de stock (atomicidad).
- Anulación correcta: stock disminuye, costo promedio **no** cambia, estado `ANULADA`, no se puede anular dos veces.
- E2E: registrar una compra de 2 productos y verificar stock y costo promedio en el detalle del producto.

### Criterios de aceptación
- [ ] Capturas de nueva compra y detalle en claro/oscuro y móvil.
- [ ] Todo en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. PR, CI verde, merge.
