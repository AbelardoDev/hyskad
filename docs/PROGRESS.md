# Progreso de HYSKAD

> Claude Code actualiza este archivo al **cerrar cada fase** y cuando una sesión se interrumpe. Es la memoria del proyecto entre sesiones.

## Estado de las fases

| Fase | Nombre | Estado | PR | Notas |
|---|---|---|---|---|
| F00 | Preparación del entorno | ✅ Terminada | — | Entorno verificado 2026-10-29 |
| F01 | Monorepo, infraestructura local y CI | ✅ Terminada | #1 | Repo público AbelardoDev/hyskad; `main` protegida por el CI |
| F02 | Base del backend | ✅ Terminada | #7 | Swagger en /api/docs (dev) |
| F03 | Autenticación, usuarios y permisos (backend) | ✅ Terminada | #8 | Usuarios dev en el README |
| F04A | Sistema de diseño, tema, i18n y layout | ✅ Terminada | #9 | Galería en /dev/ui (solo dev) |
| F04B | Sesión, guards y administración de usuarios (frontend) | ✅ Terminada | #10 | Job `e2e` en el CI; capturas en `docs/capturas/f04b` |
| F05 | Clientes y motocicletas | ✅ Terminada | #11 | Plantilla CRUD en ARCHITECTURE §6.1; capturas en `docs/capturas/f05` |
| F06 | Catálogo de productos e inventario | ✅ Terminada | #12 | Contrato de `InventarioService` en su Javadoc; capturas en `docs/capturas/f06` |
| F07 | Proveedores y compras | ✅ Terminada | #13 | `CalculadoraTotales` (RN-04) lista para ventas y órdenes; capturas en `docs/capturas/f07` |
| F08 | Ventas y comprobantes | ✅ Terminada | #14 | POS con teclado (F2/Enter/F9); comprobante carta/tirilla fuera del shell; capturas en `docs/capturas/f08` |
| F09A | Órdenes: creación, asignación, estados y diagnóstico | ✅ Terminada | #15 | Diagrama de estados en ARCHITECTURE §6.2 (verificado por `DiagramaEstadosTest`); capturas en `docs/capturas/f09a` |
| F09B | Órdenes: servicios, repuestos y presupuestos | 🟦 En curso | | |
| F09C | Órdenes: pago, entrega, historial y vista del mecánico | ⬜ Pendiente | | |
| F10 | Notificaciones en tiempo real, correos y auditoría | ⬜ Pendiente | | |
| F11 | Reportes, dashboard, búsqueda global y configuración | ⬜ Pendiente | | |
| F12 | Calidad: E2E, accesibilidad, rendimiento y seguridad | ⬜ Pendiente | | |
| F13 | Despliegue en VPS | ⬜ Pendiente | | |

Leyenda: ⬜ Pendiente · 🟦 En curso · ✅ Terminada

## Sesión actual / última sesión

- **Fase:** F09A ✅ (cerrada 2026-10-30, PR #15)
- **Rama:** `feature/f09a-ordenes-base` → `main`
- **Hecho:** módulos `servicios` (catálogo RF16 según la plantilla, 12 servicios de desarrollo) y `taller`. Migración V7 (`servicio`, `orden_trabajo` con `version` y un índice único sobre la moto mientras la orden está activa, `orden_mecanico`, `orden_estado_historial`). `EstadoOrden` declara transiciones, permiso y nota obligatoria; `OrdenTrabajo.transicionarA` valida y registra el historial; `OrdenTrabajoService` orquesta las condiciones (mecánicos, diagnóstico; ítems y pago bloqueados hasta F09B/C), recepción (RN-24, RN-25, `OT-000001`), mecánicos (RN-26), diagnóstico (RF14), seguridad por fila (RN-27, 404) y `accionesPermitidas` con `bloqueo`. Cada modificación recibe la `version` leída (409 si cambió; `OPTIMISTIC_FORCE_INCREMENT` para que asignar mecánicos también la suba). Eventos `OrdenCreada`, `MecanicoAsignado`, `EstadoOrdenCambiado` y auditoría. `taller` implementa `ConsultaOrdenesActivas` (se borró `SinOrdenesActivas`). Endpoints extra: `GET /ordenes-trabajo/recepcion` y `GET /usuarios/mecanicos`. Frontend: servicios (lista + drawer), recepción en 5 pasos con alta rápida de cliente y moto, última lectura de kilometraje y aviso de orden activa; tablero lista/kanban con filtros en la URL; "Mis órdenes" en tarjetas; detalle con línea de tiempo, acciones según `accionesPermitidas`, edición de recepción, modal de mecánicos y pestañas (ítems, presupuestos y pago deshabilitadas con "Disponible pronto"). Pruebas: backend 217 unitarias (CP-38 con 49 combinaciones y el diagrama Mermaid verificado contra el enum) y 206 IT; frontend 253 unitarias; 69 E2E + axe. Capturas en `docs/capturas/f09a/` (las del mecánico en inglés).
- **Siguiente paso concreto:** iniciar F09B con `/fase F09B` (ítems, reservas y presupuestos; quitar los bloqueos `SIN_ITEMS` y conectar la transición automática a `EN_REPARACION`).
- **Bloqueos o dudas:** ninguno.

### Sesión anterior (F08)
- **Fase:** F08 ✅ (cerrada 2026-10-30, PR #14)
- **Rama:** `feature/f08-ventas` → `main`
- **Hecho:** módulo `ventas`. Migración V6 (`venta` con `iva_porcentaje`, `monto_recibido` y datos de anulación; `venta_detalle` con precio y costo congelados). Registro en una sola transacción: ítems validados con errores por fila (`items[i].productoId`), precio tomado siempre del catálogo (un `precioUnitario` enviado da 400 `PROPIEDAD_DESCONOCIDA`), descuento ≤ subtotal, referencia obligatoria salvo efectivo, monto recibido ≥ total, numeración `V-000001`, totales con `CalculadoraTotales` y salida por ítem vía `InventarioService` (orden de id, `PESSIMISTIC_WRITE`). Anulación con motivo (RN-21, `VENTAS_ANULAR`) que devuelve el stock y publica `VentaAnulada`; comprobante con datos del taller y leyenda "Documento interno. No es factura electrónica."; lista con filtros y `GET /ventas/resumen`. Frontend: punto de venta operable solo con teclado (F2 busca, Enter agrega, flechas, Esc, F9 cobra, popover de atajos), carrito con tope del disponible, cliente opcional con alta rápida, métodos de pago con referencia y cambio en vivo, confirmación y pantalla de éxito; en móvil el carrito es una hoja inferior. Lista con resumen del periodo y "Solo mis ventas", detalle con anulación, comprobante carta/tirilla imprimible fuera del layout. Pruebas: backend 161 unitarias y 185 IT (incluida la concurrencia CP-31); frontend 244 unitarias (mismos casos de redondeo que el backend); 63 E2E + axe (las nuevas, estables en 3 repeticiones). Capturas en `docs/capturas/f08/` (y `comprobante-carta.pdf` impreso).

### Sesión anterior (F07)
- **Fase:** F07 ✅ (cerrada 2026-10-30, PR #13)
- **Rama:** `feature/f07-compras` → `main`
- **Hecho:** módulos `proveedores` (CRUD con NIT y DV, según la plantilla) y `compras`. Migración V5; registro de compra en una sola transacción (proveedor activo, fecha no futura, factura no repetida, ítems validados con errores por fila, numeración `C-000001`, totales con el IVA vigente y una entrada por ítem vía `InventarioService`); anulación con motivo (RN-17) que deja el promedio igual; filtros y auditoría. `shared.dinero.CalculadoraTotales` (RN-04) y `GET /configuracion/iva`. Frontend: proveedores (lista, drawer, ficha con sus compras), nueva compra con tabla editable (producto con stock y costo visibles, aviso de costo ±30 %, totales en vivo, confirmación), lista y detalle de compras con anulación; `hk-campos-documento` compartido con clientes. Pruebas: backend 153 unitarias y 175 IT; frontend 231 unitarias; 56 E2E + axe (las nuevas, estables en 3 repeticiones). Capturas en `docs/capturas/f07/`.

### Sesión anterior (F06)
- **Fase:** F06 ✅ (cerrada 2026-10-30, PR #12)
- **Rama:** `feature/f06-inventario` → `main`
- **Hecho:** módulos `catalogo` (categorías y productos) e `inventario`. Migración V4 (cantidades `DECIMAL(12,2)`, `CHECK` de stock, `version`), `InventarioService` como única puerta del stock (entrada por compra, salida por venta, reservar/liberar/consumir, devolución de venta, salida por anulación de compra y ajustes) con `PESSIMISTIC_WRITE`, RN-07 a RN-15 y `StockBajoDetectado`; movimientos inmutables con filtros y CSV; costo promedio oculto para quien no gestiona productos; datos dev (6 categorías, 40 productos). Frontend: productos con nivel de stock y badge, ficha con kárdex en línea de tiempo, formulario con `hk-money-input` y categoría rápida, modal de categorías, ajuste con vista previa del stock resultante, movimientos globales con CSV y contador de stock bajo en el menú. Pruebas: backend 148 unitarias y 164 IT (incluida la concurrencia de 20 reservas); frontend 218 unitarias; 49 E2E + axe (las nuevas, estables en 3 repeticiones). Capturas en `docs/capturas/f06/`.

### Sesión anterior (F05)
- **Fase:** F05 ✅ (cerrada 2026-10-30, PR #11)
- **Rama:** `feature/f05-clientes-motos` → `main`
- **Hecho:** módulos `clientes` y `motocicletas` (backend y frontend). Migración V3, servicios con RN-38 a RN-45 (normalización de documento, teléfono, placa y VIN; NIT con DV; razón social con NIT; documento, placa y VIN únicos; cambio de propietario a un cliente activo; RN-44 vía `ConsultaOrdenesActivas`), búsqueda con `Specification`, auditoría sin datos personales y datos dev (10 clientes, 15 motos). Frontend: lista de clientes (tarjetas en móvil), drawer según el tipo de documento con DV en vivo y modal de la política de datos, ficha del cliente con sus motos y "Agregar moto", lista de motos con búsqueda por placa normalizada, ficha de la moto con cambio de propietario y pestaña Historial (vacía hasta F09C), `hk-placa` y validadores espejo en `core/utils/validadores.ts`. Pruebas: backend 135 unitarias y 133 IT; frontend 203 unitarias; 41 E2E + axe (las nuevas, estables en 3 repeticiones). Capturas en `docs/capturas/f05/` (claro/oscuro, 1440/768/375 y en inglés).

### Sesión anterior
- **Fase:** F04B ✅ (cerrada 2026-10-30, PR #10)
- **Rama:** `feature/f04b-sesion-usuarios` → `main`
- **Hecho:** sesión en el frontend (`AuthService` con access token solo en memoria, restauración con `/auth/refresh` al arrancar tras un splash, renovación 60 s antes de vencer, interceptor con un único refresh compartido y reintento, interceptor de errores → toast por `code` y `errors[]` marcados en el formulario). Guards `authGuard` (incluye cambio obligatorio de contraseña), `invitadoGuard`, `sesionGuard`, `permisoGuard` (`canMatch`) y página 403; directiva `*hkTienePermiso`; menú, drawer y barra inferior filtrados por permiso. Pantallas: login dividido (429 con cuenta regresiva), olvidé/restablecer contraseña con medidor de fortaleza, cambio obligatorio, Mi perfil (idioma guardado en la cuenta) y Usuarios (tabla con búsqueda y filtros, drawer crear/editar, activar/desactivar, permisos por módulo). Backend: perfil `e2e` con `POST /api/v1/test/reset` y arreglo del deadlock en logins simultáneos. CI: job `e2e` (MySQL + Mailpit + Nginx en `docker-compose.e2e.yml`, backend con perfil e2e, Playwright en Chromium, reporte como artefacto si falla). Pruebas: 148 unitarias, 32 E2E + axe (estables en 3 repeticiones). Capturas en `docs/capturas/f04b/` (claro/oscuro, escritorio/móvil); revisado también 768 px y en inglés.

## Decisiones tomadas durante el desarrollo

<!-- Formato: AAAA-MM-DD · Fase · Decisión · Motivo -->
- 2026-10-30 · F09A · El diagnóstico se registra y corrige en `EN_DIAGNOSTICO` y `EN_REPARACION`, aprobado por el usuario · BUSINESS-RULES no lo fijaba; en reparación a veces hay que precisarlo sin devolver la orden.
- 2026-10-30 · F09A · La actividad del mecánico asignado es opcional (máx. 200), aprobado por el usuario · con un solo mecánico casi nunca hace falta.
- 2026-10-30 · F09A · "Último kilometraje registrado" (RN-25) = el mayor entre el de ingreso y el de inspección de las órdenes anteriores de la moto · la moto no guarda kilometraje; la inspección es la lectura más reciente.
- 2026-10-30 · F09A · Toda modificación de la orden (recepción, mecánicos, diagnóstico, transición) recibe la `version` que leyó el cliente y responde 409 `CONFLICTO_CONCURRENCIA` si no coincide; se carga con `OPTIMISTIC_FORCE_INCREMENT` (sin `join fetch`, que extendería el bloqueo a cliente y moto sin versión) · asignar mecánicos no cambia columnas de la orden y aun así debe invalidar la versión.
- 2026-10-30 · F09A · RN-24 también en BD: columna generada `motocicleta_activa_id` (NULL en estados finales) con índice único · dos recepciones simultáneas de la misma moto no pueden pasar ambas.
- 2026-10-30 · F09A · Las transiciones automáticas (PENDIENTE_APROBACION → EN_REPARACION) responden `TRANSICION_INVALIDA` con `motivo: AUTOMATICA` si se piden por la API; las que dependen de F09B/C quedan con su condición (`SIN_ITEMS`, `SIN_PAGO`) · el prompt pide dejarlas preparadas con su validación.
- 2026-10-30 · F09A · Las modificaciones devuelven el detalle releído en otra transacción (`GET` interno) · la versión nueva solo existe al confirmar; devolverla desde la misma transacción haría fallar la siguiente edición.
- 2026-10-30 · F09A · `GET /ordenes-trabajo/recepcion?motocicletaId=` (ORDENES_CREAR) y `GET /usuarios/mecanicos` (ORDENES_ASIGNAR u ORDENES_VER_TODAS, solo id y nombre), aprobados en el plan · la recepción necesita la última lectura y la orden activa; el vendedor asigna mecánicos pero no puede listar usuarios.
- 2026-10-30 · F09A · `GET /servicios` también con `ORDENES_TRABAJAR` · F09B agrega servicios a las órdenes desde ese catálogo.
- 2026-10-30 · F09A · El diagrama Mermaid de ARCHITECTURE §6.2 lo verifica `DiagramaEstadosTest` (falla mostrando el diagrama nuevo si el enum cambia) · "generado a partir del enum real" sin código de producción para documentación.
- 2026-10-30 · F09A · La prueba del shell (`layout.spec`) usa Inicio como página "Próximamente" · Órdenes ya hace peticiones.
- 2026-10-30 · F08 · La devolución por anulación de venta se permite aunque el producto esté inactivo (excepción a RN-15), aprobado por el usuario · RN-21 obliga a restituir el stock; desactivar un producto no puede impedir anular una venta. Resuelve la deuda RN-15 vs. RN-21.
- 2026-10-30 · F08 · La venta no acepta precios del cliente: el precio sale del catálogo y un `precioUnitario` en el cuerpo da 400 `PROPIEDAD_DESCONOCIDA` · RN-04 y CP-32; un rechazo explícito es más claro que ignorarlo en silencio.
- 2026-10-30 · F08 · La venta guarda `iva_porcentaje` y `monto_recibido` (el cambio se calcula) · el comprobante debe reproducir la venta aunque cambie el IVA vigente.
- 2026-10-30 · F08 · El comprobante vive en `/ventas/:id/comprobante` fuera del shell (sin menú), con formato carta o tirilla 80 mm y `@page` por formato · se imprime o guarda como PDF desde el navegador, sin librerías nuevas.
- 2026-10-30 · F08 · `GET /ventas/resumen` (cantidad y total de ventas pagadas con los mismos filtros) y filtro "Solo mis ventas" · la lista muestra el cierre del día sin traer todas las páginas.
- 2026-10-30 · F08 · `configuracion-api.service.ts` compartido (IVA) para compras y ventas; `hoyEnBogota` pasa a `core/utils/formato.ts` · ya lo usan dos features.
- 2026-10-30 · F08 · La prueba del layout que activaba el ítem del menú usa `/ordenes` en vez de `/ventas` · `/ventas` ya tiene rutas reales.
- 2026-10-30 · F07 · Un producto inactivo, repetido o inexistente en una compra responde 400 `VALIDACION` con `errors[]` por ítem (`items[i].productoId`), aprobado por el usuario · el prompt pide 400 y así el formulario marca la fila; el 409 del inventario queda de respaldo en la misma transacción.
- 2026-10-30 · F07 · Los costos de compra se ingresan sin IVA; el IVA (vigente, RN-03) se suma al total y el costo promedio usa el costo sin IVA, aprobado por el usuario · RN-02 registra precios sin IVA.
- 2026-10-30 · F07 · `FACTURA_DUPLICADA` (409) si el mismo proveedor ya tiene una compra registrada con ese número de factura; anulada la primera, se puede volver a registrar, aprobado por el usuario · evita meter el stock dos veces.
- 2026-10-30 · F07 · La compra guarda `iva_porcentaje` además del valor del impuesto y los datos de anulación (`motivo_anulacion`, `anulada_por`, `anulada_en`); quien la registra es `created_by` · RN-03 y RN-17; ARCHITECTURE no los listaba.
- 2026-10-30 · F07 · `ProductoService.bloquear` relee el producto con `refresh(PESSIMISTIC_WRITE)` · la compra valida los productos antes de moverlos; si el producto ya estaba cargado, un `select … for update` no refresca su estado y se trabajaría con existencias viejas.
- 2026-10-30 · F07 · Los ítems se mueven en orden de id de producto · dos compras simultáneas con los mismos productos bloquean las filas en el mismo orden (sin deadlock).
- 2026-10-30 · F07 · `GET /api/v1/configuracion/iva` para cualquier usuario autenticado · la nueva compra (y la venta en F08) muestra totales en vivo; la edición de la configuración llega en F11.
- 2026-10-30 · F07 · `hk-campos-documento` (tipo, número y DV en vivo) en el kit y `numeroConDv`/`documentoSegunTipo` en `validadores.ts`; el mensaje de `DOCUMENTO_DUPLICADO` pasa a ser genérico · lo comparten clientes y proveedores.
- 2026-10-30 · F07 · `formatoFecha` trata `aaaa-mm-dd` como día del calendario · `new Date('2026-10-30')` es medianoche UTC y en Colombia mostraba el 29 (lo reveló una captura).
- 2026-10-30 · F07 · El ayudante de axe de las E2E espera a que terminen las animaciones finitas · con la opacidad de entrada a medias, axe calculaba mal el contraste (fallo intermitente).
- 2026-10-30 · F06 · Cantidades de inventario `DECIMAL(12,2)`, aprobado por el usuario · hay unidades fraccionables (litro, galón, metro).
- 2026-10-30 · F06 · El ajuste de entrada lleva un costo unitario opcional (sin él, el promedio vigente) y recalcula el promedio con RN-07, aprobado por el usuario · si entrara siempre al promedio, el stock inicial de un producto nuevo entraría a $0 y distorsionaría la primera compra.
- 2026-10-30 · F06 · Presupuesto del bundle inicial: aviso en 900 kB (error 1,2 MB), aprobado por el usuario · `@lucide/angular` es un solo módulo y cada ícono suma ~4 kB al inicial; hoy 821 kB (156 kB comprimido).
- 2026-10-30 · F06 · `inventario` depende de `catalogo` y no al revés: `InventarioService` obtiene el producto bloqueado con `ProductoService.bloquear` (`Propagation.MANDATORY`) y las reglas viven en la entidad `Producto` · evita el ciclo y que otro módulo use el repositorio de productos.
- 2026-10-30 · F06 · Las reservas no generan movimiento (solo cambian `stock_reservado`) · RN-11 registra cambios de existencias y sus tipos no incluyen reservas; consumir una reserva sí genera `SALIDA_ORDEN`.
- 2026-10-30 · F06 · Los movimientos (con costos) los ven `PRODUCTOS_GESTIONAR` o `INVENTARIO_AJUSTAR` (admin y almacén), aprobado por el usuario en el plan · la tabla de permisos no los menciona.
- 2026-10-30 · F06 · Todos los métodos de `InventarioService` rechazan productos inactivos, también la devolución de una venta anulada · lo pide el prompt; si un producto se desactiva y luego se anula una venta suya, habrá que reactivarlo (ver deuda técnica).
- 2026-10-30 · F06 · Una categoría inactiva no se elige para productos nuevos, pero los existentes la conservan; nombre de categoría único · no hay regla de negocio sobre categorías.
- 2026-10-30 · F06 · CSV de movimientos generado en el backend (UTF-8 con BOM, `;`, máx. 10 000 filas) con celdas que empiezan por `= + - @` neutralizadas · se abre directo en Excel en español y evita inyección de fórmulas con el motivo.
- 2026-10-30 · F06 · Contador de stock bajo del menú (`ContadoresService`) se carga al iniciar sesión y se recarga tras crear, editar o ajustar · hasta F10 no hay tiempo real.
- 2026-10-30 · F05 · `ConsultaOrdenesActivas` vive en `clientes.application` (el prompt decía `motocicletas`), aprobado por el usuario · `motocicletas` depende de `clientes`; si `ClienteService` usara una interfaz de `motocicletas` habría un ciclo que ArchUnit prohíbe.
- 2026-10-30 · F05 · Desactivar un cliente no desactiva sus motos; a un cliente inactivo no se le asignan motos (`CLIENTE_INACTIVO`, al crear o al cambiar de dueño), aprobado por el usuario · RN-44 solo habla de órdenes activas.
- 2026-10-30 · F05 · Teléfono del cliente obligatorio y colombiano de 10 dígitos (`@TelefonoColombiano`: celular `3…` o fijo `60…`, se guarda sin `+57` ni separadores); email, dirección y ciudad opcionales · el prompt pide teléfono de 10 dígitos y el taller necesita un contacto.
- 2026-10-30 · F05 · Con NIT el usuario escribe 9 dígitos y el DV se calcula en vivo; si escribe los 10, se valida el DV escrito · RN-39 y prompt ("DV calculado en vivo").
- 2026-10-30 · F05 · La fecha de autorización de datos se fija al autorizar, se conserva al editar y se borra si se retira · RN-45 guarda la decisión y la fecha; no hay regla para el retiro.
- 2026-10-30 · F05 · `cantidadMotos` y `nombreCompleto` del cliente con `@Formula` (subconsulta SQL) · `clientes` no puede depender de `motocicletas`, y así se ordena y busca por nombre sin columna duplicada.
- 2026-10-30 · F05 · El texto de la política de datos sale de las traducciones (es/en) · RN-45 lo pide configurable; la pantalla de configuración llega en F11.
- 2026-10-30 · F05 · `CambioEstado` (`PATCH .../estado`) y `Patrones.contiene` pasan a `shared` y los usa también `usuarios` · tres módulos con el mismo record y el mismo escape de `LIKE`.
- 2026-10-30 · F05 · La lista de clientes no tiene menú de acciones por fila: la fila abre la ficha, donde están editar y activar/desactivar · un botón dentro de una fila clicable es un control interactivo anidado (axe/ESLint).
- 2026-10-30 · F05 · `success-ink` claro `#047857` → `#04724F`, y `contrast:check` valida los badges también sobre `bg` · el badge "Activa" de la ficha de la moto (sobre el fondo de página) daba 4,47:1.
- 2026-10-30 · F05 · `src/test-setup.ts` (`setupFiles` de Vitest) vacía `localStorage` y `sessionStorage` después de cada prueba · el idioma `en` que dejaba `language.service.spec` se filtraba a otras pruebas según el orden del CI (el formulario de cliente salía en inglés).
- 2026-10-30 · F05 · Sin íconos nuevos: se reutilizan los registrados · `@lucide/angular` es un solo módulo y esbuild lo deja entero en el bundle inicial aunque el ícono solo lo use una ruta diferida (se probó registrarlos por ruta: no reduce nada).
- 2026-10-30 · F04B · El enlace de recuperación usa la ruta `/restablecer?token=` (la que ya arma el backend desde F03) · no cambiar el contrato del correo.
- 2026-10-30 · F04B · Con sesión iniciada, el idioma elegido se guarda en la cuenta (`PUT /auth/me/preferencias`) y al recuperar la sesión manda el de la cuenta · el idioma es una preferencia del usuario (RF de perfil), no del navegador.
- 2026-10-30 · F04B · CP-09 se cubre con la acción "Nueva venta" (`*hkTienePermiso="'VENTAS_CREAR'"`) y la ruta `/ventas/nueva` con `permisoGuard`, aprobado por el usuario · el módulo de ventas llega en F08.
- 2026-10-30 · F04B · Rate limit desactivable solo en el perfil e2e (`hyskad.auth.rate-limit=false`); el 429 de la UI se prueba con una respuesta simulada · las E2E inician sesión muchas veces desde la misma IP; CP-03 sigue en la integración.
- 2026-10-30 · F04B · `POST /api/v1/test/reset` hace `flyway.clean()` + `migrate()` con `db/dev-data`; se llama una vez en el `globalSetup` y cada E2E crea sus propios usuarios por la API · las pruebas corren en paralelo sin pisarse.
- 2026-10-30 · F04B · Build `e2e` (optimizado, sin reemplazar `dev.routes`) para que la galería `/dev/ui` siga probándose en el CI; Nginx de e2e con `BACKEND_PORT` configurable · en local el 8080 suele estar ocupado por el backend de dev.
- 2026-10-30 · F04B · `hk-page-header` entra solo con opacidad (`animate-aparecer`) y `--animate-entrada` usa `fill-mode: backwards` (antes `both`) · un `transform` animado convierte al elemento en contenedor de los `position: fixed`: la acción flotante del encabezado quedaba detrás de la topbar en móvil.
- 2026-10-30 · F04B · Seis íconos nuevos reemplazados por equivalentes ya registrados y `AuthLayout` cargado en diferido · el bundle inicial pasaba el presupuesto de aviso (819 kB → 796 kB).
- 2026-10-30 · F04B · `CuentaService.autenticar` hace `flush()` tras registrar el último acceso · dos logins simultáneos del mismo usuario provocaban un deadlock en MySQL (bloqueo compartido por las FK de auditoría/refresh token y luego exclusivo por el UPDATE).
- 2026-10-29 · F04A · Íconos con `@lucide/angular` (paquete oficial sucesor) en vez de `lucide-angular` · `lucide-angular` 1.0 solo admite Angular ≤ 21.
- 2026-10-29 · F04A · Presupuesto del bundle inicial subido a 800 kB (aviso) / 1,2 MB (error), aprobado por el usuario · cada ícono de `@lucide/angular` trae su plantilla compilada (~4 kB, ~250 kB en total); transferido comprimido ≈ 132 kB.
- 2026-10-29 · F04A · `ring` claro `#2F74F5` (no `#5698FF`), tokens `-ink` para texto sobre `-soft` y `border-strong` para bordes de controles · el contraste AA no se cumplía con los valores originales; documentado en DESIGN-SYSTEM §1.2.
- 2026-10-29 · F04A · Contraste verificado con `scripts/contrast-check.mjs` que lee `styles.css` (no una prueba con valores copiados) · una sola fuente de verdad; corre en el CI junto con `i18n:check`.
- 2026-10-29 · F04A · `@theme static` para la escala de marca · Tailwind v4 omite las variables no usadas y `hk-chart` (F11) las leerá en tiempo de ejecución.
- 2026-10-29 · F04A · `hk-button`/`hk-icon-button` son componentes de atributo (`<button hk-button>`, `<a hk-button>`); ESLint permite selectores de atributo y `elements-content` acepta `etiqueta` · conservan `type`, `routerLink` y la semántica nativa.
- 2026-10-29 · F04A · `select` y `date-input` usan los controles nativos del navegador con estilo del kit · accesibles y cómodos en móvil sin reimplementarlos.
- 2026-10-29 · F04A · Moneda en `hk-money-input` como entero de pesos (máx. 13 dígitos, DECIMAL(15,2)) · el COP se muestra sin decimales.
- 2026-10-29 · F04A · `LOCALE_ID` se fija al arrancar; los pipes propios (`cop`, `fecha`, `tiempoRelativo`, impuros) siguen el idioma activo sin recargar · Angular no permite cambiar `LOCALE_ID` en caliente.
- 2026-10-29 · F04A · Migas y título de la pestaña desde `data.miga` de cada ruta (`routeConfig.data`, sin herencia) · las rutas hijas con path vacío no duplican la miga.
- 2026-10-29 · F04A · Selector de idioma oculto en la topbar por debajo de 640 px y disponible al pie del drawer móvil · no caben siete botones de 44 px en 375 px.
- 2026-10-29 · F04A · La galería `/dev/ui` vive dentro del shell y se excluye de producción con `fileReplacements` (`dev.routes.prod.ts`) · axe revisa a la vez el kit y el layout.
- 2026-10-29 · F03 · Los comandos de entrada (records con Bean Validation, p. ej. `CrearUsuario`) viven en `application` y se usan directamente como `@RequestBody`; las respuestas (`web/dto`) y el mapper MapStruct van en `web` · ArchUnit prohíbe `application → web` y así no se duplican records.
- 2026-10-29 · F03 · La contraseña débil responde 400 `VALIDACION` con `errors[].code = PASSWORD_DEBIL` (igual que `PLACA_INVALIDA` en F02) · la política es un validador de Bean Validation reutilizable. Límite superior de 72 bytes UTF-8 (BCrypt).
- 2026-10-29 · F03 · Cualquier refresh token revocado que vuelva a presentarse (rotado o cerrado con logout) revoca todos los del usuario y se audita `REFRESH_REUTILIZADO` · regla de CP-05 sin excepciones.
- 2026-10-29 · F03 · `login` y `refresh` usan `@Transactional(noRollbackFor = BusinessException.class)` · la auditoría del login fallido y la revocación por reúso deben persistir aunque se responda 401.
- 2026-10-29 · F03 · RN-48 también se aplica al cambiar el rol de un usuario (cambia sus permisos efectivos) · evento `AccesoUsuarioModificado` escuchado por `RefreshTokenService` en la misma transacción.
- 2026-10-29 · F03 · RN-47: `ULTIMO_ADMIN` se verifica antes que `AUTO_MODIFICACION` (con bloqueo de los admins activos) · es la única forma de que CP-08 sea alcanzable, porque solo un admin puede gestionar usuarios.
- 2026-10-29 · F03 · Cambiar el rol conserva los ajustes de permisos; un permiso solo admin concedido nunca se suma a un rol distinto de ADMIN · no hay regla que diga borrarlos.
- 2026-10-29 · F03 · Rate limiting adicional por CLAUDE.md (`/auth/password/**`): restablecer 10/15 min por IP y cambiar contraseña 10/15 min por usuario. Buckets en memoria (un solo nodo); el mapa se vacía al superar 50 000 claves.
- 2026-10-29 · F03 · Cambiar la contraseña (autenticado) no revoca las demás sesiones; restablecerla sí (RN-50) · no hay regla para el primer caso.
- 2026-10-29 · F03 · Email de usuario normalizado (trim + minúsculas) antes de guardar y buscar · la unicidad no depende de mayúsculas.
- 2026-10-29 · F03 · `JWT_SECRET` tiene valor por defecto solo en `application-dev.yml` (y uno fijo en test), como la contraseña de BD de dev; en prod es obligatoria. La cookie lleva `Secure` salvo en dev (`hyskad.auth.cookie-secure=false`, sin HTTPS local).
- 2026-10-29 · F03 · `CorreoService` en `shared.correo` (plantillas `templates/email/`, textos `i18n/correos*.properties`) · lo reutilizarán las notificaciones de F10.
- 2026-10-29 · F03 · GreenMail 2.1.14 (`greenmail-junit5`, test) para verificar correos en las IT, aprobado por el usuario.
- 2026-10-29 · F01 · Transloco se instala ya en F01 · la página de ping no debe tener textos quemados; F04A completa la configuración de i18n.
- 2026-10-29 · F01 · Seguridad temporal en `com.hyskad.ping.PingSecurityConfig` (solo `/api/v1/ping` y `/actuator/health` públicos, lo demás `denyAll`) · se reemplaza en F02/F03.
- 2026-10-29 · F01 · La regla JaCoCo es por paquete (`com.hyskad.*.application*`, `*.domain*`); sin paquetes que coincidan no evalúa nada · cumple "excluir mientras no haya clases" sin flags extra.
- 2026-10-29 · F02 · `TipoDocumento` vive en `shared.validation` (no en `clientes.domain`) · lo comparten clientes y proveedores y lo necesita `@DocumentoValido`.
- 2026-10-29 · F02 · `SecurityConfig` base en `shared.config`: todo autenticado salvo `/actuator/health` y `/api/docs`, `/api/swagger-ui/**`; 401/403 se delegan al `GlobalExceptionHandler` · F03 agrega el JWT sobre esta misma cadena.
- 2026-10-29 · F02 · `type` del ProblemDetail = `urn:hyskad:error:<CODE>` · ARCHITECTURE §4 exige `type` y Spring omite `about:blank`.
- 2026-10-29 · F02 · Códigos de `errors[]`: el mensaje de la restricción si ya es un código (`PLACA_INVALIDA`, `NIT_INVALIDO`) o el nombre de la restricción en UPPER_SNAKE (`NotBlank` → `NOT_BLANK`) · el frontend los traduce sin depender de textos en inglés.
- 2026-10-29 · F02 · Pruebas de integración con sufijo `IT` ejecutadas por `maven-failsafe-plugin`; contenedor MySQL compartido vía `TestcontainersConfiguration` + anotación `@IntegrationTest` · reutiliza el contexto de Spring entre clases.
- 2026-10-29 · F02 · ArchUnit: `shared` se excluye como destino en las reglas de capas (es transversal) y `archRule.failOnEmptyShould=false` para que las reglas genéricas no fallen mientras un módulo no exista.
- 2026-10-29 · F02 · Collation del contenedor dev alineada a `utf8mb4_0900_ai_ci` (ARCHITECTURE §3).
- 2026-10-29 · F01 · Puerto de MySQL del host configurable (`DB_HOST_PORT`, por defecto 3306) · en esta máquina hay otro MySQL en el 3306.
- 2026-10-29 · F01 · springdoc desactivado en el perfil `prod`.
- 2026-10-29 · F01 · En Windows/Git Bash, `./mvnw` falla por TLS (schannel) contra repo.maven.apache.org; usar `mvnw.cmd` desde PowerShell. La caché de npm por defecto daba ECONNRESET; se usó `npm_config_cache=%TEMP%
pm-cache-hk`.

## Deuda técnica conocida

<!-- Qué quedó pendiente a propósito y por qué -->
- Los refresh tokens y enlaces de recuperación vencidos no se purgan de la BD (crecen despacio; se puede agregar una tarea programada más adelante).
- `debeCambiarPassword` no bloquea otros endpoints en el backend: solo lo hace cumplir el frontend (`authGuard`).
- Aviso de Mockito por auto-attach del agente en las pruebas del backend (JDK 25); sin impacto por ahora.
- Las E2E corren en el CI solo en Chromium (los tres navegadores en F12). Bajo carga paralela del servidor de desarrollo, Firefox puede exceder el timeout de 30 s (en serie pasan).
- La campana de notificaciones muestra un estado vacío hasta F10.
- Detrás de Nginx (F13) el rate limit verá la IP del proxy: configurar `server.forward-headers-strategy` y confiar solo en el proxy propio.
- `GET /motocicletas/{id}/historial` devuelve `[]` con la estructura final (`HistorialServicio`); se llena en F09C (CP-21).
- El texto de autorización de datos (RN-45) está en las traducciones; hacerlo configurable en F11.
- Presupuesto del bundle inicial: aviso subido a 900 kB en F06 (hoy 843 kB). Si vuelve a acercarse, cambiar el registro de íconos (p. ej. SVG por URL) en vez de seguir subiéndolo.
- `VentaAnulada` se publica pero nadie lo escucha hasta F10 (auditoría y notificaciones).
- `OrdenCreada`, `MecanicoAsignado` y `EstadoOrdenCambiado` se publican pero nadie los escucha hasta F10 (notificaciones y correos).
- Las acciones "Enviar presupuesto" y "Entregar" aparecen bloqueadas (`SIN_ITEMS`, `SIN_PAGO`) hasta F09B/F09C.
- E2E del diagnóstico: una vez, con la suite completa en paralelo, el guardado tardó más de 5 s (sin errores en el backend); vigilar en el CI.
- `StockBajoDetectado` se publica pero nadie lo escucha hasta F10 (notificaciones); la configuración `stock.alerta.habilitada` se aplicará allí.
- El filtro por usuario de `GET /inventario/movimientos` existe en la API pero no en la pantalla (almacén no puede listar usuarios).
