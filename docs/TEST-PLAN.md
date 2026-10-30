# Plan de pruebas de HYSKAD

## 1. Objetivo

Verificar que HYSKAD cumple los requisitos de la ERS (RF1–RF35, interfaces y RNF) y las reglas de `BUSINESS-RULES.md`, y demostrar el objetivo específico del proyecto: **al menos el 90 % de los casos de prueba con resultado satisfactorio** antes de la entrega final.

## 2. Niveles y herramientas

| Nivel | Qué prueba | Herramienta | Dónde vive |
|---|---|---|---|
| Unitarias backend | Reglas de negocio en servicios y entidades (cálculos, transiciones, validadores) | JUnit 5, Mockito, AssertJ | `backend/src/test/java/.../application`, `.../domain` |
| Integración backend | Endpoints completos contra MySQL real: seguridad, validación, transacciones, migraciones | `@SpringBootTest` + MockMvc + Testcontainers (MySQL 8.4) | `backend/src/test/java/.../web` (sufijo `IT`) |
| Arquitectura | Reglas de capas y módulos | ArchUnit | `ArquitecturaTest` |
| Unitarias frontend | Servicios, guards, interceptores, pipes, validadores, componentes del kit y de negocio | Vitest + Angular Testing Library/TestBed | `*.spec.ts` junto a cada archivo |
| E2E | Flujos completos de usuario en navegador | Playwright | `e2e/tests` |
| Accesibilidad | Violaciones WCAG 2.1 AA en pantallas principales, claro y oscuro | `@axe-core/playwright` | `e2e/tests/a11y` |
| Rendimiento | Tiempos de respuesta con 8 usuarios concurrentes | k6 | `infra/k6` |
| Seguridad | Autenticación, autorización por permiso, rate limit, cabeceras, inyección | Pruebas de integración + revisión manual + `npm audit` + Dependabot | varios |
| Usabilidad | Tareas reales con personas del taller | Sesión guiada con checklist | `docs/test-reports/usabilidad.md` |

## 3. Criterios

**Cobertura mínima:** JaCoCo ≥ 70 % de líneas en paquetes `application` y `domain` (el build falla si baja). Frontend: todo servicio, guard, interceptor y validador con pruebas; componentes de negocio con al menos la prueba de render y la de su acción principal.

**Criterio de entrada de cada fase:** la fase anterior está en `main` con CI en verde.

**Criterio de salida de cada fase (Definition of Done):**
1. Todos los casos `CP-*` de la fase implementados como pruebas automatizadas (o ejecutados manualmente si son de tipo *Manual*) y en verde.
2. CI en verde.
3. `docs/PROGRESS.md` y la columna **Estado** de este plan actualizados.

**Criterio de aceptación final:** `casos aprobados / casos ejecutados ≥ 90 %`, sin ningún caso fallido de prioridad **Alta** en seguridad, inventario, pagos o integridad de datos.

## 4. Datos de prueba

- Migración de datos de ejemplo **solo para el perfil `dev`** (`backend/src/main/resources/db/dev-data`, activada por `spring.flyway.locations` del perfil): 1 usuario por rol, 10 clientes, 15 motos, 40 productos en 6 categorías, 3 proveedores, servicios de catálogo y órdenes en todos los estados.
- En pruebas de integración cada clase crea sus propios datos con *builders* (`ClienteTestBuilder`, etc.). Nada depende del orden de ejecución.
- E2E: un endpoint `POST /api/v1/test/reset` disponible **solo** en el perfil `e2e` que reinicia la BD con los datos semilla.

## 5. Gestión de defectos

Cada fallo encontrado fuera de la fase en curso se registra como *issue* en GitHub con etiqueta `bug`, severidad (`sev:alta|media|baja`) y el caso `CP-*` o requisito afectado. El PR que lo corrige incluye la prueba que lo reproduce.

## 6. Catálogo de casos de prueba

Tipos: **U** unitaria · **I** integración · **E** E2E · **A** accesibilidad · **R** rendimiento · **M** manual.
Estado: `Pendiente` → `Aprobado` / `Fallido` (Claude Code lo actualiza al cerrar cada fase).

### Base del backend (F02)
| ID | Req. | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|---|
| CP-69 | IS2, RNF Mant. | Flyway sobre MySQL 8.4 vacío y arranque con `ddl-auto=validate` | I | Migraciones aplicadas sin fallos; el contexto levanta | Aprobado |
| CP-70 | RNF Integridad | Cada tipo de error (validación de cuerpo y parámetros, JSON mal formado, propiedad desconocida, tipo inválido, 401, 403, 404, 405, 415, 409 concurrencia e integridad, 500) | I | `ProblemDetail` con `type`, `code` estable, `requestId` y `errors[]` en validación; sin detalles internos | Aprobado |
| CP-71 | RN-52 | 10 hilos piden consecutivo a la vez; rollback no consume número | I | Números distintos y seguidos, sin huecos | Aprobado |
| CP-72 | RN-38, RN-39 | Documentos CC/TI/CE/PA/PPT/NIT válidos e inválidos, incluidos NIT reales | U | Acepta/rechaza con `DOCUMENTO_INVALIDO` o `NIT_INVALIDO` | Aprobado |
| CP-73 | RNF Mant. | Reglas de arquitectura (capas, persistencia por módulo, controllers sin repositorios ni entidades, sin ciclos) | U (ArchUnit) | Sin violaciones | Aprobado |
| CP-74 | RNF Observ. | `X-Request-Id` recibido se reutiliza; uno inseguro se reemplaza | I | La respuesta y el MDC llevan el id | Aprobado |

### Autenticación y usuarios (F03–F04)
| ID | Req. | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|---|
| CP-01 | RF2 | Login con credenciales válidas | I, E | 200, access token y cookie refresh `HttpOnly`; el front entra al dashboard | Pendiente |
| CP-02 | RF2, RN-49 | Login con contraseña errónea o usuario inactivo | I | 401 con mensaje genérico idéntico en ambos casos | Pendiente |
| CP-03 | IC6, RN-49 | Sexto intento de login en un minuto | I | 429 | Pendiente |
| CP-04 | IC3 | Petición con token expirado → refresh automático | U (interceptor), E | Se renueva el token y la petición original se completa | Pendiente |
| CP-05 | IC3 | Reutilizar un refresh token ya rotado | I | 401 y se revoca toda la familia de tokens | Pendiente |
| CP-06 | RF1, RNF Seg. | Crear usuario con contraseña débil | I | 400 `PASSWORD_DEBIL` | Pendiente |
| CP-07 | RF1 | Crear usuario con email repetido | I | 409 `EMAIL_DUPLICADO` | Pendiente |
| CP-08 | RF3, RN-47 | Desactivar el único admin activo | I | 409 `ULTIMO_ADMIN` | Pendiente |
| CP-09 | RF4 | Retirar `VENTAS_CREAR` a un vendedor | I, E | El endpoint responde 403 y la opción desaparece del menú | Pendiente |
| CP-10 | IS4 | Mecánico llama a `GET /usuarios` | I | 403 | Pendiente |
| CP-11 | RF35, RN-50 | Recuperación con correo existente y no existente | I | Misma respuesta 202; solo el existente recibe correo (Mailpit/GreenMail) | Pendiente |
| CP-12 | RF35 | Usar enlace de recuperación vencido o ya usado | I | 400 `TOKEN_INVALIDO` | Pendiente |
| CP-13 | RNF Seg. | Contraseña guardada | I | Hash BCrypt, nunca texto plano; no aparece en logs ni respuestas | Pendiente |

### Clientes y motocicletas (F05)
| ID | Req. | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|---|
| CP-14 | RF5 | Registrar cliente CC válido con autorización de datos | I, E | 201 y ficha visible | Pendiente |
| CP-15 | RN-39 | NIT con dígito de verificación incorrecto | U, I | 400 `NIT_INVALIDO` | Pendiente (U backend aprobada en F02; I en F05) |
| CP-16 | RN-40 | Documento duplicado | I | 409 | Pendiente |
| CP-17 | RF7, RN-41 | Placas `ABC12D`, `abc-12d`, `ABC12`, `123ABC` válidas; `AB123`, `ABCD12` inválidas | U (back y front) | Normaliza y acepta/rechaza según patrón | Pendiente (U backend aprobada en F02; front en F05) |
| CP-18 | RF7 | Placa duplicada | I | 409 `PLACA_DUPLICADA` | Pendiente |
| CP-19 | RF6, RN-44 | Desactivar cliente con orden activa | I | 409 | Pendiente |
| CP-20 | RF29 | Buscar clientes por nombre parcial, documento y teléfono | I | Resultados paginados correctos | Pendiente |
| CP-21 | RF9 | Historial de una moto con 3 órdenes | I, E | Lista ordenada por fecha con servicios, repuestos y totales | Pendiente |

### Inventario, proveedores y compras (F06–F07)
| ID | Req. | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|---|
| CP-22 | RF17 | Crear producto con código duplicado | I | 409 | Pendiente |
| CP-23 | RF21, RN-07 | Compra de 10 u a $12.000 sobre 10 u a $10.000 | U, I | Stock 20, costo promedio $11.000, movimiento `ENTRADA_COMPRA` | Pendiente |
| CP-24 | RF18, RN-13 | Ajuste de salida que dejaría stock bajo lo reservado | I | 409 `STOCK_INSUFICIENTE` | Pendiente |
| CP-25 | RN-11 | Cada movimiento queda registrado con stock resultante y usuario | I | Fila en `movimiento_inventario` coherente | Pendiente |
| CP-26 | RN-14 | Stock cruza el mínimo | I | Se publica un único `StockBajoDetectado` | Pendiente |
| CP-27 | RN-17 | Anular compra sin stock disponible suficiente | I | 409 | Pendiente |
| CP-28 | RF20 | CRUD de proveedor con NIT válido | I | Operaciones correctas | Pendiente |

### Ventas (F08)
| ID | Req. | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|---|
| CP-29 | RN-04 | Cálculo de totales con descuento e IVA 19 % | U | Valores exactos con redondeo HALF_UP | Pendiente |
| CP-30 | RN-19 | Vender más que el disponible | I | 409 y no cambia el stock | Pendiente |
| CP-31 | RN-12 | Dos ventas simultáneas de la última unidad | I (concurrencia) | Exactamente una confirma; stock final 0, nunca −1 | Pendiente |
| CP-32 | RN-21 | Anular venta | I, E | Stock devuelto, movimientos `DEVOLUCION_ANULACION_VENTA`, estado `ANULADA` | Pendiente |
| CP-33 | RN-21 | Vendedor sin `VENTAS_ANULAR` intenta anular | I | 403 | Pendiente |
| CP-34 | RF27 | Comprobante de venta | E | Vista imprimible con leyenda de documento interno | Pendiente |

### Taller (F09)
| ID | Req. | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|---|
| CP-35 | RF10, RN-25 | Crear orden con moto de otro cliente | I | 400 `MOTO_NO_PERTENECE_CLIENTE` | Pendiente |
| CP-36 | RN-24 | Segunda orden activa para la misma moto | I | 409 | Pendiente |
| CP-37 | RN-25 | Kilometraje menor al último registrado | I | 400 | Pendiente |
| CP-38 | RF13, RN-22 | Todas las transiciones válidas e inválidas del diagrama | U (parametrizada) | Válidas pasan, inválidas `TRANSICION_INVALIDA` | Pendiente |
| CP-39 | RF12, RN-27 | Mecánico consulta una orden no asignada | I | 404 (no revela existencia) | Pendiente |
| CP-40 | RF19, RN-29 | Agregar repuesto reserva stock; quitarlo lo libera | I | `stock_reservado` correcto en ambos pasos | Pendiente |
| CP-41 | RN-28 | Agregar ítem con orden `EN_REPARACION` | I | 409 | Pendiente |
| CP-42 | RF22, RN-31 | Generar presupuesto y luego otro | I | El primero queda `REEMPLAZADO`, versión 2 `PENDIENTE` | Pendiente |
| CP-43 | RF23, RN-33 | Aprobar presupuesto | I, E | Orden pasa a `EN_REPARACION` | Pendiente |
| CP-44 | RF23, RN-33 | Rechazar presupuesto | I | Orden `CANCELADA`, reservas liberadas | Pendiente |
| CP-45 | RF24 | Total de orden con servicios, repuestos, descuento e IVA | U | Coincide con el presupuesto aprobado | Pendiente |
| CP-46 | RN-29 | Finalizar orden | I | Stock descontado, reservas en 0, movimientos `SALIDA_ORDEN` | Pendiente |
| CP-47 | RF25, RN-35 | Pago con monto distinto al total | I | 400 `MONTO_INVALIDO` | Pendiente |
| CP-48 | RF28, RN-36 | Entregar sin pago | I | 409 `PAGO_REQUERIDO` | Pendiente |
| CP-49 | RF26 | Cuentas pendientes | I | Solo órdenes finalizadas sin pago con días transcurridos | Pendiente |
| CP-50 | Flujo | Recepción → diagnóstico → presupuesto → aprobación → reparación → finalización → pago → entrega | E | Flujo completo sin errores con 3 roles distintos | Pendiente |
| CP-51 | IU6 | Vista del mecánico en 375 px | E, M | Usable, sin scroll horizontal, botones ≥ 44 px | Pendiente |

### Notificaciones, auditoría, reportes y dashboard (F10–F11)
| ID | Req. | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|---|
| CP-52 | RF30 | Cambio de estado notifica en tiempo real | I (SSE), E | La campana se actualiza sin recargar en < 2 s | Pendiente |
| CP-53 | RF30, RN-45 | Orden finalizada envía correo solo a cliente con autorización | I | Correo recibido solo cuando corresponde | Pendiente |
| CP-54 | RF30 | Fallo del SMTP no revierte la operación | I | La orden cambia de estado; el error queda en log | Pendiente |
| CP-55 | RF31, RN-51 | Auditoría de una anulación de venta | I | Registro con usuario, acción, entidad, IP y fecha | Pendiente |
| CP-56 | RF32 | Reporte de servicios por rango y mecánico | I | Totales correctos | Pendiente |
| CP-57 | RF33 | Reporte de inventario con stock bajo | I | Lista correcta y exportable a CSV | Pendiente |
| CP-58 | RF34 | KPIs del dashboard con datos semilla | I | Valores coinciden con consulta manual | Pendiente |

### Requisitos no funcionales (F12–F13)
| ID | Req. | Caso | Tipo | Resultado esperado | Estado |
|---|---|---|---|---|---|
| CP-59 | RNF Rend. | 8 usuarios concurrentes, operaciones habituales, 5 min | R | p95 ≤ 2 s, 0 % errores | Pendiente |
| CP-60 | RNF Rend. | Reportes con 12 meses de datos | R | p95 ≤ 5 s | Pendiente |
| CP-61 | RNF Seg. | Inyección SQL y XSS en búsquedas y formularios | I, M | Sin ejecución; datos escapados | Pendiente |
| CP-62 | RNF Seg. | Cabeceras de seguridad en producción | M | HSTS, CSP, X-Content-Type-Options, Referrer-Policy presentes | Pendiente |
| CP-63 | IC1, IC7 | HTTP redirige a HTTPS; puerto 3306 cerrado desde Internet | M | Redirección 301; `nmap` no muestra 3306 | Pendiente |
| CP-64 | RNF Acc. | axe en login, dashboard, órdenes, venta, en claro y oscuro | A | 0 violaciones serias o críticas | Pendiente |
| CP-65 | RNF Compat. | Flujos E2E en Chromium, Firefox y WebKit | E | En verde en los tres | Pendiente |
| CP-66 | RNF Disp. | Backup diario y restauración en BD limpia | M | Restauración completa y app funcional | Pendiente |
| CP-67 | RNF Desp. | Despliegue desde cero con el pipeline | M | App operativa con HTTPS sin pasos manuales fuera del runbook | Pendiente |
| CP-68 | IU / Usab. | Sesión con usuarios reales (una tarea por rol) | M | ≥ 80 % de tareas completadas sin ayuda | Pendiente |

## 7. Informe de pruebas

Al cerrar F12 se genera `docs/test-reports/INFORME-PRUEBAS.md` con: fecha, versión (commit), resumen por tipo, tabla de casos con resultado, porcentaje de aprobación, cobertura (JaCoCo y Vitest), resultados de k6 y axe, defectos abiertos y conclusión frente al objetivo del 90 %.
