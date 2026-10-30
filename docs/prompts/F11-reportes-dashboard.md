# F11 — Reportes, dashboard, búsqueda global y configuración

**Rama:** `feature/f11-reportes-dashboard`
**Requisitos:** RF29, RF32, RF33, RF34 · IU5 · RNF Rendimiento (reportes ≤ 5 s) · RN-53
**Lee antes:** `CLAUDE.md`, `docs/DESIGN-SYSTEM.md` §6 (`hk-chart`, `hk-command-palette`) y §7 (Dashboard)

## Prompt

Ejecuta la fase F11 de HYSKAD: panel de control, reportes, búsqueda global con paleta de comandos y pantalla de configuración del taller. Muéstrame un plan corto y espera mi OK.

### Backend
- **Dashboard** `GET /dashboard?desde&hasta` (por defecto, hoy y últimos 30 días), respuesta adaptada a los permisos del usuario:
  - KPIs: ventas de hoy (cantidad y monto), ingresos de órdenes entregadas hoy, órdenes activas, pendientes de aprobación, finalizadas sin cobrar (monto), productos con stock bajo.
  - Series: ingresos diarios (ventas + órdenes) de los últimos 30 días; órdenes por estado; top 5 servicios y top 5 repuestos del periodo.
  - Listas cortas: últimas 5 órdenes actualizadas, 5 productos con stock más crítico.
  - Para MECANICO: solo sus órdenes por estado y sus órdenes finalizadas en el mes.
  - Consultas agregadas con JPQL/SQL nativo de solo lectura (`@Transactional(readOnly = true)`), agrupando por día en zona `America/Bogota` (RN-53). Agrega índices si el plan de ejecución lo pide.
- **Reportes** (`REPORTES_VER`, con alcance según rol de `ARCHITECTURE.md` §5):
  - `GET /reportes/servicios` (RF32): por rango, tipo de servicio y mecánico → cantidad de órdenes, servicios realizados, ingresos por mano de obra y repuestos, tiempo promedio en taller, y detalle.
  - `GET /reportes/inventario` (RF33): existencias, valor del inventario a costo promedio, productos con stock bajo/agotados, y movimientos del periodo por tipo.
  - `GET /reportes/ventas`: por rango, vendedor y método de pago; incluye utilidad bruta (precio − costo congelado).
  - Todos con `?formato=csv` para exportar (UTF-8 con BOM para que Excel abra bien las tildes).
- **Búsqueda global** `GET /busqueda?q=` (mín. 2 caracteres): hasta 5 resultados por tipo (clientes, motos por placa, órdenes por número, productos por código/nombre, ventas por número) respetando permisos.
- **Configuración** `GET/PUT /configuracion` (`CONFIGURACION_GESTIONAR`): datos del taller (nombre, NIT con DV, dirección, teléfono, email, texto de autorización de datos), porcentaje de IVA, umbrales. Auditado.

### Frontend
- **`hk-chart`**: wrapper de Chart.js (registro de solo los controladores usados), colores tomados de los tokens CSS, re-render al cambiar tema o idioma, tooltip con formato COP, accesible (tabla de datos oculta visualmente con `sr-only`). Tipos: línea/área, barras, dona.
- **Dashboard** según `DESIGN-SYSTEM.md` §7: saludo con el nombre y la fecha, fila de `hk-stat-card` con contadores animados, gráfica de ingresos (área con degradado azul), dona de órdenes por estado (colores de §1.3), listas de últimas órdenes y stock crítico, selector de periodo. Skeletons mientras carga. Vista distinta para el mecánico.
- **Reportes**: página con pestañas (Servicios, Inventario, Ventas, Cuentas pendientes), filtros arriba, KPIs del resultado, gráfica y tabla, botón **Exportar CSV** e **Imprimir** (estilo de impresión limpio).
- **`hk-command-palette`** (`Ctrl/⌘ + K` y clic en el buscador de la topbar): resultados agrupados por tipo con íconos, navegación con flechas, Enter para abrir; además acciones rápidas según permisos ("Nueva venta", "Recibir moto", "Nuevo cliente", "Cambiar tema"). Debounce de 250 ms.
- **Configuración**: formulario por secciones (Taller, Impuestos, Privacidad).
- Revisión general de coherencia visual: recorre todas las pantallas y unifica espacios, títulos, estados vacíos y skeletons que hayan quedado distintos.

### Pruebas obligatorias
CP-56, CP-57, CP-58, CP-20 (búsqueda global), y además:
- Agrupación por día en zona Bogotá: una venta a las 23:30 hora Colombia cuenta en ese día y no en el siguiente.
- CSV con tildes y separador correcto; los montos sin formato de miles.
- Un vendedor no recibe el reporte de inventario con costos; un mecánico no accede a reportes.
- Unitarias: `hk-chart` cambia colores al cambiar tema; la paleta navega con teclado.
- E2E: abrir la paleta con `Ctrl+K`, buscar una placa y llegar al detalle de la moto.

### Criterios de aceptación
- [ ] Capturas del dashboard (admin y mecánico), reportes y paleta en claro/oscuro y móvil.
- [ ] Todo en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. PR, CI verde, merge.
