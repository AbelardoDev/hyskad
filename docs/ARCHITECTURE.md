# Arquitectura de HYSKAD

## 1. Vista general

```
 Navegador (Angular SPA)
        │  HTTPS 443
        ▼
 ┌───────────────────── VPS Ubuntu (Docker Compose) ─────────────────────┐
 │  nginx ── sirve /  (build de Angular)                                  │
 │    │      proxy /api/** ──► backend:8080 (Spring Boot)                 │
 │    │      proxy /api/v1/notificaciones/stream (SSE, sin buffering)     │
 │    └─ certbot (Let's Encrypt)                                          │
 │  backend ──► mysql:3306 (red interna, sin puerto publicado)  [IC7]     │
 │  backend ──► SMTP externo (Brevo/Gmail en prod; Mailpit en dev) [IC5]  │
 └────────────────────────────────────────────────────────────────────────┘
```

Front y API se sirven desde el **mismo dominio** (`https://hyskad.tudominio.com` y `/api`). Así la cookie del refresh token es `SameSite=Strict` y CORS solo hace falta en desarrollo (`http://localhost:4200`) [IC4].

## 2. Backend — monolito modular por capas

```
com.hyskad
├── HyskadApplication.java
├── shared/
│   ├── config/          # Security, OpenAPI, Jackson, Async, CORS, Clock
│   ├── security/        # JWT, filtros, UsuarioActual, permisos
│   ├── error/           # GlobalExceptionHandler, BusinessException, ErrorCode
│   ├── audit/           # entidad Auditoria, listener, servicio
│   ├── persistence/     # BaseEntity (id, createdAt, updatedAt, createdBy, updatedBy)
│   ├── web/             # PageResponse, utilidades de paginación
│   ├── validation/      # @PlacaColombiana, @DocumentoValido, validadores
│   ├── consecutivo/     # numeración OT-000001, V-000001, C-000001
│   └── dinero/          # CalculadoraTotales (RN-04), clase pura sin Spring
├── auth/                # login, refresh, logout, me, recuperación de contraseña
├── usuarios/            # usuarios, roles, permisos (RF1–RF4)
├── configuracion/       # datos del taller, IVA, parámetros (clave/valor)
├── clientes/            # RF5, RF6
├── motocicletas/        # RF7, RF8, RF9 (historial)
├── catalogo/            # categorías y productos/repuestos (RF17)
├── inventario/          # movimientos, existencias, reservas, costo promedio (RF18)
├── proveedores/         # RF20
├── compras/             # RF21
├── ventas/              # ventas de mostrador, anulación, comprobante
├── servicios/           # catálogo de servicios del taller (RF16)
├── taller/              # órdenes, estados, mecánicos, diagnóstico, ítems,
│                        # presupuestos, pagos, entrega (RF10–RF15, RF19, RF22–RF28)
├── notificaciones/      # in-app (SSE) + correo (RF30)
├── reportes/            # RF32, RF33, cuentas pendientes RF26
└── dashboard/           # RF34
```

Dentro de cada módulo:

```
clientes/
├── web/            ClienteController, dto/ (ClienteRequest, ClienteResponse, ClienteFiltro)
├── application/    ClienteService, ClienteMapper
├── domain/         Cliente, TipoDocumento
└── persistence/    ClienteRepository, ClienteSpecifications
```

Reglas de dependencia (verificadas con ArchUnit en `ArquitecturaTest`):
- `web` → `application` → `domain`; `persistence` → `domain`.
- `domain` no depende de `web` ni de Spring Web.
- Ninguna clase fuera de un módulo usa su paquete `persistence`.
- Ningún `@RestController` depende de un `Repository`.
- No hay ciclos de dependencias entre módulos (`slices().matching("com.hyskad.(*)..").should().beFreeOfCycles()`, excluyendo `shared`).

## 3. Modelo de datos (3FN)

Todas las tablas tienen `id BIGINT AUTO_INCREMENT`, `created_at`, `updated_at` y, donde aplique, `created_by`/`updated_by` (FK a `usuario`). Las bajas son **lógicas** (`activo`), nunca `DELETE` físico de datos de negocio. Charset `utf8mb4`, collation `utf8mb4_0900_ai_ci`.

### Seguridad y sistema
| Tabla | Campos clave | Notas |
|---|---|---|
| `usuario` | nombre, email (UQ), telefono, password_hash, rol, activo, idioma, ultimo_acceso | `rol` ∈ ADMIN, ALMACEN, VENDEDOR, MECANICO |
| `usuario_permiso` | usuario_id, permiso, concedido (bool) | Ajustes por usuario sobre los permisos de su rol (RF4). PK (usuario_id, permiso) |
| `refresh_token` | usuario_id, token_hash (UQ), expira_en, revocado_en, reemplazado_por | Rotación |
| `token_recuperacion` | usuario_id, token_hash (UQ), expira_en (30 min), usado_en | Un solo uso (RF35) |
| `auditoria` | usuario_id, accion, entidad, entidad_id, detalle (JSON), ip, fecha | RF31; índice (entidad, entidad_id) y (fecha) |
| `configuracion` | clave (UQ), valor, descripcion | `iva.porcentaje`=19, `taller.nombre`, `taller.nit`, `taller.direccion`, `taller.telefono`, `stock.alerta.habilitada` |
| `consecutivo` | tipo (UQ), siguiente | OT, VENTA, COMPRA, PRESUPUESTO; se lee con bloqueo |

### Clientes y motocicletas
| Tabla | Campos clave | Notas |
|---|---|---|
| `cliente` | tipo_documento, numero_documento, nombres, apellidos, razon_social, telefono, email, direccion, ciudad, acepta_tratamiento_datos, fecha_aceptacion_datos, activo | UQ (tipo_documento, numero_documento). NIT → razon_social |
| `motocicleta` | cliente_id, placa (UQ), marca, modelo, anio, vin (UQ, nullable), cilindrada_cc, color, activo | Placa normalizada en mayúsculas sin espacios ni guiones |

### Catálogo, inventario, compras y ventas
| Tabla | Campos clave | Notas |
|---|---|---|
| `categoria` | nombre (UQ), descripcion, activo | |
| `producto` | codigo (UQ), nombre, descripcion, marca, categoria_id, unidad, precio_venta, costo_promedio, stock_actual, stock_reservado, stock_minimo, activo | `stock_disponible = stock_actual - stock_reservado` (calculado, no columna). CHECK stock_actual ≥ 0, stock_reservado ≥ 0 |
| `movimiento_inventario` | producto_id, tipo, cantidad, costo_unitario, stock_resultante, referencia_tipo, referencia_id, motivo, usuario_id, fecha | Inmutable (solo INSERT) |
| `proveedor` | tipo_documento, numero_documento, razon_social, contacto, telefono, email, direccion, activo | UQ (tipo_documento, numero_documento) |
| `compra` | numero (UQ), proveedor_id, numero_factura_proveedor, fecha, subtotal, impuesto, total, estado, usuario_id | estado ∈ REGISTRADA, ANULADA |
| `compra_detalle` | compra_id, producto_id, cantidad, costo_unitario, subtotal | |
| `venta` | numero (UQ), cliente_id (nullable = consumidor final), fecha, subtotal, descuento, impuesto, total, metodo_pago, referencia_pago, estado, motivo_anulacion, anulada_por, anulada_en, usuario_id | estado ∈ PAGADA, ANULADA |
| `venta_detalle` | venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal | Precios y costos **congelados** al momento de la venta |

### Taller
| Tabla | Campos clave | Notas |
|---|---|---|
| `servicio` | nombre (UQ), descripcion, precio_base, tiempo_estimado_min, activo | Catálogo (RF16) |
| `orden_trabajo` | numero (UQ), cliente_id, motocicleta_id, fecha_ingreso, kilometraje_ingreso, motivo_ingreso, descripcion_problema, observaciones, estado, diagnostico, observaciones_diagnostico, subtotal, descuento, impuesto, total, fecha_finalizacion, fecha_entrega, entregada_por, observaciones_entrega, version | `version` para bloqueo optimista |
| `orden_mecanico` | orden_id, mecanico_id, actividad, asignado_en | PK (orden_id, mecanico_id) (RF12) |
| `orden_servicio` | orden_id, servicio_id (nullable), descripcion, precio, tiempo_min, mecanico_id | Servicio de catálogo o mano de obra libre (RF15) |
| `orden_repuesto` | orden_id, producto_id, cantidad, precio_unitario, costo_unitario, agregado_por | Reserva stock al agregarse (RF19) |
| `orden_estado_historial` | orden_id, estado_anterior, estado_nuevo, nota, usuario_id, fecha | Trazabilidad |
| `presupuesto` | orden_id, numero (UQ), version, subtotal, descuento, impuesto, total, estado, fecha_envio, fecha_decision, decidido_por, observaciones | estado ∈ PENDIENTE, APROBADO, RECHAZADO, REEMPLAZADO |
| `presupuesto_item` | presupuesto_id, tipo (SERVICIO/REPUESTO), descripcion, cantidad, precio_unitario, subtotal | Copia congelada de los ítems |
| `pago` | orden_id (UQ), monto, metodo, referencia, fecha, usuario_id | Pago total único (RF25) |

### Notificaciones
| Tabla | Campos clave |
|---|---|
| `notificacion` | usuario_id, tipo, titulo_clave, mensaje_clave, parametros (JSON), enlace, leida, fecha |

Las notificaciones guardan **claves de i18n + parámetros**, no texto, para mostrarse en el idioma de cada usuario.

## 4. API REST — convenciones

- Base `/api/v1`. JSON. Fechas ISO-8601 en UTC (`Instant`); el front muestra en `America/Bogota`.
- `GET /recurso?page=0&size=20&sort=fecha,desc&q=texto&...filtros` → `PageResponse { content, page, size, totalElements, totalPages }`.
- `POST` crea (201 + `Location`), `PUT` reemplaza, `PATCH` cambia estado o campos puntuales, `DELETE` no se usa para datos de negocio (se usa `PATCH .../desactivar`).
- Acciones de dominio como sub-recursos con verbo claro: `POST /ordenes-trabajo/{id}/transiciones`, `POST /ventas/{id}/anulacion`, `POST /presupuestos/{id}/decision`.
- Errores: `ProblemDetail` con `type`, `title`, `status`, `detail`, `code`, `errors[]` (campo + código) para validación.
- Swagger UI en `/api/docs` (solo perfiles `dev` y `test`; deshabilitado en `prod`).

Endpoints principales (orientativos; cada fase los detalla):

```
POST   /auth/login | /auth/refresh | /auth/logout      GET /auth/me
POST   /auth/password/olvide | /auth/password/restablecer
CRUD   /usuarios  (+ PATCH /{id}/estado, PUT /{id}/permisos)
CRUD   /clientes, /motocicletas (+ GET /motocicletas/{id}/historial)
CRUD   /categorias, /productos   GET /productos/stock-bajo
GET    /inventario/movimientos   POST /inventario/ajustes
CRUD   /proveedores   POST/GET /compras (+ POST /{id}/anulacion)
POST/GET /ventas (+ POST /{id}/anulacion, GET /{id}/comprobante)
CRUD   /servicios
POST/GET /ordenes-trabajo   GET /ordenes-trabajo/mias
PUT    /ordenes-trabajo/{id}/mecanicos     PUT /{id}/diagnostico
POST/DELETE /ordenes-trabajo/{id}/servicios | /{id}/repuestos
POST   /ordenes-trabajo/{id}/transiciones
POST   /ordenes-trabajo/{id}/presupuestos  POST /presupuestos/{id}/decision | /presupuestos/{id}/retiro
GET    /ordenes-trabajo/resumen-estados
POST   /ordenes-trabajo/{id}/pago          POST /ordenes-trabajo/{id}/entrega
GET    /ordenes-trabajo/{id}/comprobante
GET    /notificaciones  PATCH /{id}/leida  POST /notificaciones/stream-ticket  GET /notificaciones/stream (SSE)
GET    /reportes/servicios | /reportes/inventario | /reportes/cuentas-pendientes
GET    /dashboard   GET /busqueda?q=   GET /auditoria
GET/PUT /configuracion
```

## 5. Roles y permisos (RF4)

Permisos efectivos de un usuario = **permisos por defecto de su rol** + ajustes en `usuario_permiso` (conceder o retirar). El administrador puede retirar cualquier permiso de un usuario y conceder permisos adicionales, excepto los marcados como *solo admin*. Los roles son un conjunto cerrado (enum).

| Permiso | ADMIN | ALMACEN | VENDEDOR | MECANICO |
|---|:-:|:-:|:-:|:-:|
| `DASHBOARD_VER` | ✔ | ✔ | ✔ | ✔ (vista propia) |
| `USUARIOS_GESTIONAR` *(solo admin)* | ✔ | | | |
| `CONFIGURACION_GESTIONAR` *(solo admin)* | ✔ | | | |
| `AUDITORIA_VER` *(solo admin)* | ✔ | | | |
| `CLIENTES_VER` | ✔ | | ✔ | ✔ |
| `CLIENTES_GESTIONAR` | ✔ | | ✔ | |
| `MOTOS_VER` | ✔ | | ✔ | ✔ |
| `MOTOS_GESTIONAR` | ✔ | | ✔ | |
| `PRODUCTOS_VER` | ✔ | ✔ | ✔ | ✔ |
| `PRODUCTOS_GESTIONAR` | ✔ | ✔ | | |
| `INVENTARIO_AJUSTAR` | ✔ | ✔ | | |
| `PROVEEDORES_GESTIONAR` | ✔ | ✔ | | |
| `COMPRAS_GESTIONAR` | ✔ | ✔ | | |
| `VENTAS_VER` | ✔ | ✔ | ✔ | |
| `VENTAS_CREAR` | ✔ | | ✔ | |
| `VENTAS_ANULAR` | ✔ | | | |
| `SERVICIOS_GESTIONAR` (catálogo) | ✔ | | | |
| `ORDENES_VER_TODAS` | ✔ | ✔ | ✔ | |
| `ORDENES_VER_ASIGNADAS` | ✔ | | | ✔ |
| `ORDENES_CREAR` | ✔ | | ✔ | |
| `ORDENES_ASIGNAR` | ✔ | | ✔ | |
| `ORDENES_TRABAJAR` (diagnóstico, ítems, estados técnicos) | ✔ | | ✔ | ✔ (solo asignadas) |
| `PRESUPUESTOS_GESTIONAR` | ✔ | | ✔ | |
| `PAGOS_REGISTRAR` | ✔ | | ✔ | |
| `ENTREGAS_REGISTRAR` | ✔ | | ✔ | |
| `REPORTES_VER` | ✔ | ✔ (inventario) | ✔ (servicios, cuentas) | |

Implementación: enum `Permiso` + `Map<Rol, Set<Permiso>> PERMISOS_POR_ROL` en código (no en BD), y `usuario_permiso` solo para las excepciones. El JWT lleva los permisos efectivos como `authorities`. Al cambiar permisos o desactivar un usuario se revocan sus refresh tokens.

## 6. Patrones de diseño usados (y por qué)

Solo estos, cada uno con un problema real que resolver. Cualquier otro requiere justificación escrita en el PR.

| Patrón | Dónde | Por qué se justifica |
|---|---|---|
| **Máquina de estados** (enum con transiciones permitidas) | `EstadoOrden` en `taller` | La orden tiene 7 estados y reglas de transición; centralizarlas evita `if` dispersos y hace trivial probar transiciones válidas e inválidas. Es una versión ligera del patrón *State*: el enum define `puedeTransicionarA(...)` y la entidad aplica efectos. |
| **Observer** vía eventos de Spring (`ApplicationEventPublisher` + `@TransactionalEventListener(AFTER_COMMIT)`) | Notificaciones, correos, alertas de stock bajo | `taller`, `inventario` y `ventas` no deben conocer al módulo `notificaciones`. El evento se procesa solo si la transacción se confirmó. |
| **Specification** (JPA `Specification`) | Búsquedas y filtros (RF29) | Combina filtros opcionales sin escribir una consulta por cada combinación. |
| **DTO + Mapper** | Todos los módulos | Desacopla el contrato de la API del modelo de persistencia y evita exponer datos sensibles. |
| **Repository** | Spring Data | Lo provee el framework. |
| **Inversión de dependencias** (interfaz en el módulo que pregunta, implementación en el que sabe) | `clientes.application.ConsultaOrdenesActivas` implementada por `taller` (F09A); hasta entonces `SinOrdenesActivas` responde `false` | `taller` depende de `clientes`/`motocicletas`; para que estos consulten si hay órdenes activas (RN-44) sin crear un ciclo de dependencias. Vive en `clientes` (no en `motocicletas`) porque la usan los dos módulos y `motocicletas` ya depende de `clientes`. |
| **Strategy** *(solo si llega a hacer falta)* | — | No se usa de entrada. Se evaluaría si aparece un segundo cálculo de impuestos o un segundo canal de notificación con lógica distinta. |

Lo que **no** se hace: interfaces `XService` + `XServiceImpl` con una sola implementación, fábricas genéricas, capas "manager", herencia profunda de entidades.

## 6.1 Plantilla de módulo CRUD

Patrón fijado en F05 con `clientes` y `motocicletas`; los módulos siguientes (proveedores, catálogo, servicios…) lo copian.

**Backend** (`com.hyskad.<modulo>`):

| Capa | Clases | Reglas |
|---|---|---|
| `domain` | Entidad (`extends BaseEntity`, `@Getter`, constructor protegido para JPA) + `record Datos<Entidad>` con los valores ya normalizados | La entidad se crea y se actualiza con ese record (`actualizar(datos)`) y expone métodos de negocio (`cambiarEstado`, `cambiarPropietario`). Sin setters sueltos. Campos derivados de solo lectura con `@Formula` (p. ej. `nombreCompleto`, conteos de otra tabla sin depender del otro módulo) |
| `persistence` | `<Entidad>Repository extends JpaRepository, JpaSpecificationExecutor` + `<Entidad>Specifications` | `filtrar(...)` = `Specification.allOf(...)` de filtros opcionales; texto parcial con `Patrones.contiene()` (escapa `%` y `_`). `@EntityGraph` en las consultas cuya respuesta incluye una relación (open-in-view está apagado) |
| `application` | `<Entidad>Service` + comandos de entrada (`record` con Bean Validation: `Guardar<Entidad>` o `Crear…`/`Actualizar…`) | El servicio normaliza (`Normalizador`), verifica unicidad (`ConflictException` con un `ErrorCode` propio, p. ej. `PLACA_DUPLICADA`), guarda y audita (`AuditoriaService.registrar`) con los **nombres** de los campos cambiados, nunca datos personales. `obtener(id)` lanza `NotFoundException`. Cambio de estado idempotente |
| `web` | `<Entidad>Controller`, `<Entidad>Mapper` (MapStruct) y `dto/` (`<Entidad>Response` y, si el listado debe mostrar menos, `<Entidad>ResumenResponse`) | `GET` paginado con `@PageableDefault` y filtros como `@RequestParam` opcionales → `PageResponse`; `GET /{id}`; `POST` (201 + `Location`); `PUT /{id}`; `PATCH /{id}/estado` con `shared.web.CambioEstado`. `@PreAuthorize` por método: `<X>_VER` para leer, `<X>_GESTIONAR` para escribir |

Pruebas mínimas: IT del controller con permisos por rol (401 sin token, 403 por rol), creación con normalización y auditoría, duplicados (409), validaciones (400 con `errors[]`), búsqueda/filtros paginados y 404; unitarias de la entidad si tiene reglas. Datos de desarrollo en `db/dev-data/R__<modulo>_dev.sql` con `INSERT IGNORE`.

**Frontend** (`features/<modulo>/`):

| Archivo | Contenido |
|---|---|
| `<modulo>-api.service.ts` | Interfaces del contrato (resumen, detalle, datos de guardado, filtros) y métodos `listar/obtener/crear/actualizar/cambiarEstado`; acepta un `HttpContext` opcional (`erroresManejados()`, `conFormulario(form)`) |
| `<modulo>-page.ts` | `hk-page-header` con la acción principal bajo `*hkTienePermiso`, `hk-filter-bar` + `hk-select` de estado, `hk-table` con `rxResource` sobre una signal de filtros, orden por columna, paginación, filas clicables hacia el detalle y estados de carga, vacío y error |
| `<entidad>-detalle-page.ts` | `id` por `input()` (binding de rutas), `rxResource` del recurso, skeleton, estado de error con "Volver", acciones de editar y activar/desactivar con `ConfirmacionService` |
| `<entidad>-form-drawer.ts` | Formulario reactivo tipado en `hk-drawer`, validadores espejo del backend (`core/utils/validadores.ts`), `enfocarPrimerError`, errores del servidor marcados con `marcarErroresServidor`; cierra devolviendo lo guardado |
| `<modulo>.routes.ts` | `''` (lista) y `':id'` (detalle, `data.miga`), cargados en diferido; el `canMatch` con `permisoGuard` va en `app.routes.ts` |

Textos en `es.json`/`en.json` bajo la clave del módulo; códigos de error nuevos en `errors.*` y errores de validación locales en `validacion.*`. E2E del flujo principal + axe de lista, formulario y detalle en claro y oscuro.

> Íconos: `@lucide/angular` es un único módulo, así que cualquier ícono nuevo (aunque solo lo use una ruta diferida) suma ~4 kB al bundle inicial (aviso en 900 kB desde F06). Antes de registrar uno nuevo en `shared/ui/iconos.ts`, reutilizar uno existente.

**Módulos que mueven stock** (ventas, compras, taller) no tocan `Producto` ni sus existencias: llaman a `inventario.application.InventarioService` dentro de su propia transacción, con una `Referencia(tipo, id, numero)` del documento. El contrato de cada método (qué bloquea, qué valida, qué movimiento crea y qué devuelve) está en su Javadoc.

## 7. Tiempo real y notificaciones (RF30, IC5)

- Eventos de dominio: `OrdenCreada`, `MecanicoAsignado`, `EstadoOrdenCambiado`, `PresupuestoEnviado`, `PresupuestoDecidido`, `OrdenFinalizada`, `OrdenEntregada`, `StockBajoDetectado`, `VentaAnulada`.
- `NotificacionListener` (AFTER_COMMIT, `@Async`) decide destinatarios, guarda la notificación y la empuja por **SSE** (`SseEmitter` por usuario, registro en memoria; heartbeat cada 25 s).
- El navegador no puede mandar cabeceras en `EventSource`, así que el stream se autentica con un **ticket de un solo uso** de 30 s: `POST /notificaciones/stream-ticket` (con JWT) → `GET /notificaciones/stream?ticket=...`.
- Correo con `JavaMailSender` + plantillas Thymeleaf (`templates/email/*.html`), `@Async`, con reintento simple y registro del fallo (si el correo falla, la operación de negocio **no** se revierte).
- Correos a **clientes** (si tienen email y aceptaron tratamiento de datos): ingreso de la moto, presupuesto pendiente (con detalle), moto lista para recoger, entrega con resumen. En español.
- Correos a **usuarios**: recuperación de contraseña, y opcionalmente asignación de orden.

## 8. Frontend

```
src/app/
├── core/
│   ├── auth/          # AuthService (signal del usuario), interceptor JWT+refresh, guards por permiso
│   ├── layout/        # ShellComponent (sidebar, topbar), command palette (Ctrl+K)
│   ├── theme/         # ThemeService: system | light | dark, persiste en localStorage
│   ├── i18n/          # config de Transloco, LanguageService
│   ├── realtime/      # NotificacionesStreamService (EventSource + reconexión)
│   ├── http/          # interceptor de errores → toast traducido por `code`
│   └── utils/         # formatters (moneda COP, fechas), validators (placa, documento)
├── shared/ui/         # kit propio (ver DESIGN-SYSTEM.md)
└── features/
    ├── auth/          # login, olvidé contraseña, restablecer
    ├── dashboard/
    ├── usuarios/
    ├── clientes/      # lista, detalle (con motos), formulario
    ├── motocicletas/  # lista, detalle con historial
    ├── inventario/    # productos, categorías, movimientos, ajustes
    ├── proveedores/  compras/  ventas/  servicios/
    ├── taller/        # tablero de órdenes, detalle con pestañas, vista mecánico
    ├── reportes/  notificaciones/  configuracion/  perfil/
```

- Rutas lazy por feature con `canMatch: [permisoGuard('ORDENES_VER_TODAS')]`.
- Menú lateral generado desde una config que declara el permiso requerido de cada ítem.
- `AuthService` recupera la sesión al iniciar la app llamando a `/auth/refresh` (la cookie viaja sola).
- Interceptor: añade `Authorization`, ante 401 intenta un único refresh en curso (cola de peticiones) y reintenta; si falla, cierra sesión.

## 9. Perfiles y configuración

| Perfil | Uso | BD | Correo |
|---|---|---|---|
| `dev` | Local | MySQL de `docker-compose.dev.yml` | Mailpit (UI en :8025) |
| `test` | Pruebas | Testcontainers MySQL 8.4 | GreenMail o mock |
| `prod` | VPS | MySQL en red interna | SMTP externo |

Variables de entorno: `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` (≥ 256 bits, base64), `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM`, `APP_BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (solo para crear el primer admin si no existe ninguno).

## 10. Observabilidad (RNF)

- Logs JSON en `prod` (Logback), con `requestId` (MDC) por petición y usuario autenticado.
- Spring Boot Actuator: solo `health` e `info` expuestos, y solo dentro de la red de Docker.
- `GlobalExceptionHandler` registra los 5xx con stacktrace y los 4xx en nivel `WARN` sin stacktrace.
