# F06 — Catálogo de productos e inventario

**Rama:** `feature/f06-inventario`
**Requisitos:** RF17, RF18, RF29 (productos) · RNF Integridad, Confiabilidad (transacciones atómicas), Trazabilidad · RN-07, RN-08, RN-10 a RN-15
**Lee antes:** `CLAUDE.md`, `docs/BUSINESS-RULES.md` §2 y §3, `docs/ARCHITECTURE.md` §3 (catálogo e inventario) y la "Plantilla de módulo CRUD"

## Prompt

Ejecuta la fase F06 de HYSKAD: módulos `catalogo` (categorías y productos) e `inventario` (existencias, reservas, movimientos y costo promedio). Este es el corazón de la integración del sistema: ventas, compras y taller van a depender del servicio de inventario, así que su API debe ser clara y muy bien probada. Muéstrame un plan corto y espera mi OK.

### Backend
- Migración: `categoria`, `producto` (con `CHECK` de stock no negativo y `version`), `movimiento_inventario`.
- **`catalogo`**: CRUD de categorías y productos (código único normalizado en mayúsculas, precio de venta > 0, stock mínimo ≥ 0, unidad: `UNIDAD`, `LITRO`, `GALON`, `KIT`, `PAR`, `METRO`). El stock **no** se edita desde el CRUD del producto; solo cambia por movimientos. Al crear un producto el stock inicia en 0 (el stock inicial se carga con una compra o un ajuste de entrada).
- **`inventario` — `InventarioService`** como única puerta para mover stock. API pública pensada para los otros módulos:
  - `registrarEntradaCompra(productoId, cantidad, costoUnitario, referencia)` → recalcula costo promedio (RN-07).
  - `registrarSalidaVenta(productoId, cantidad, referencia)` → devuelve el costo unitario aplicado.
  - `reservar(productoId, cantidad, referencia)` / `liberarReserva(...)` / `consumirReserva(...)` (salida por orden).
  - `registrarDevolucionVenta(productoId, cantidad, costoUnitario, referencia)` (RN-09).
  - `registrarSalidaAnulacionCompra(...)` (RN-17).
  - `ajustar(productoId, tipo, cantidad, motivo)` (RN-13).
  - Todos bloquean el producto con `PESSIMISTIC_WRITE` (RN-12), validan RN-10, crean el movimiento (RN-11) y publican `StockBajoDetectado` cuando corresponde (RN-14). Rechazan productos inactivos (RN-15).
  - `Referencia` como `record(tipo, id, numero)` para no acoplar inventario a ventas/compras/taller.
- Endpoints: CRUD `/categorias`, `/productos` (filtros: texto, categoría, marca, estado, `soloStockBajo`), `GET /productos/stock-bajo`, `GET /inventario/movimientos` (filtros: producto, tipo, rango de fechas, usuario), `POST /inventario/ajustes`.
- Las respuestas de producto incluyen `stockActual`, `stockReservado`, `stockDisponible` (calculado) y `estadoStock` (`OK`, `BAJO`, `AGOTADO`). El `costoPromedio` solo se envía a quien tenga `PRODUCTOS_GESTIONAR`.
- Auditoría de CRUD y ajustes. Datos de desarrollo: 6 categorías y 40 productos realistas de taller de motos (aceites, filtros, pastillas, kits de arrastre, llantas, bujías, bombillos, guayas...) con stock inicial cargado por ajustes de entrada.

### Frontend (`features/inventario`)
- **Productos**: tabla con código, nombre, categoría, marca, precio, disponible (con barra o indicador de nivel frente al mínimo) y badge de estado de stock; filtros y búsqueda; detalle con pestaña de movimientos (línea de tiempo con íconos por tipo: entrada verde, salida, reserva, ajuste).
- **Formulario de producto** con `hk-money-input` y selector de categoría con creación rápida.
- **Categorías**: gestión simple en un modal o página.
- **Movimientos**: listado global con filtros y exportación CSV.
- **Ajuste de inventario**: formulario con producto (combobox con stock visible), tipo, cantidad, motivo; muestra el stock resultante antes de confirmar.
- Indicador de "stock bajo" con contador en el menú lateral para quien tenga `PRODUCTOS_GESTIONAR`.

### Pruebas obligatorias
CP-22, CP-23 (fórmula), CP-24, CP-25, CP-26, y además:
- **Unitarias** del cálculo de costo promedio (incluyendo stock 0, decimales y redondeo).
- **Concurrencia**: 20 hilos reservando del mismo producto con stock 10 → exactamente 10 reservas exitosas, `stock_reservado = 10`.
- Reservar → consumir: el stock actual baja y la reserva vuelve a 0, con un solo movimiento `SALIDA_ORDEN`.
- Producto inactivo rechazado en cualquier movimiento.
- Mecánico ve productos sin `costoPromedio`.
- E2E: crear producto, ajustar entrada, ver el movimiento y el stock actualizado.

### Criterios de aceptación
- [ ] Javadoc breve en cada método público de `InventarioService` (contrato para los demás módulos).
- [ ] Capturas de productos y ajuste en claro/oscuro y móvil.
- [ ] Todo en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. PR, CI verde, merge.
