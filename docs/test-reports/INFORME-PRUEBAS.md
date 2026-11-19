# Informe de pruebas de HYSKAD

| Dato | Valor |
|---|---|
| Fecha de las corridas | 2026-11-17 (k6 y verificación de configuración) y 2026-11-18 (resto) |
| Versión | rama `feature/f12-calidad`, commit `41201fd` |
| Plan de referencia | `docs/TEST-PLAN.md` (138 casos, §6) |
| Entorno | Windows 11, Docker Desktop; MySQL 8.4 en contenedor (Testcontainers para integración, `docker-compose.e2e.yml` para E2E, `docker-compose.perf.yml` para k6) |
| Responsable | Claude Code, con revisión del autor del proyecto |

Todas las cifras de este informe salen de corridas reales. Lo que no se ejecutó aparece como **No ejecutado**.

## 1. Resultado global

| Indicador | Valor |
|---|---|
| Casos en el catálogo | 138 |
| Ejecutados | 133 |
| Aprobados | 133 |
| Fallidos | 0 |
| No ejecutados | 5 (CP-62, CP-63, CP-66, CP-67: dependen del servidor de F13; CP-68: sesión con usuarios reales) |
| **Aprobación (aprobados / ejecutados)** | **100 %** |
| Aprobación sobre el catálogo completo (aprobados / 138) | 96,4 % |

**Conclusión frente al objetivo:** se cumple el criterio de aceptación de `TEST-PLAN.md` §3: al menos el 90 % de los casos ejecutados aprobados, y ningún caso de prioridad Alta fallido en seguridad, inventario, pagos o integridad. El resultado se mantiene aunque los 5 casos pendientes se cuenten como no aprobados (96,4 %). Antes de la entrega final quedan por ejecutar los 4 casos de F13 y la sesión de usabilidad.

## 2. Resumen por nivel

| Nivel | Herramienta | Pruebas | Resultado |
|---|---|---|---|
| Unitarias backend | JUnit 5, Mockito, AssertJ | 229 | 229 aprobadas |
| Arquitectura | ArchUnit (incluida en las unitarias) | 8 | 8 aprobadas |
| Integración backend | `@SpringBootTest` + MockMvc + Testcontainers (MySQL 8.4) | 259 | 259 aprobadas |
| Unitarias frontend | Vitest | 315 (36 archivos) | 315 aprobadas |
| Lint y build del frontend | ESLint, Angular CLI | — | Sin errores ni warnings |
| E2E | Playwright, 5 proyectos | 276 ejecuciones (90 por navegador de escritorio, 3 por teléfono) | 276 aprobadas (ver §4) |
| Accesibilidad | `@axe-core/playwright` (dentro de las E2E) | 5 suites en claro y oscuro | 0 violaciones serias o críticas |
| Rendimiento | k6 | 2 escenarios | Umbrales cumplidos (ver §5) |
| Seguridad | Integración, E2E, `npm audit`, revisión de logs, Dependency-Check | ver §6 | Aprobado (Dependency-Check: 0 tras subir el conector MySQL) |
| Usabilidad | Sesión guiada | 4 tareas | No ejecutado |

Comandos usados: `./mvnw verify` en `backend/`; `npm run lint`, `npm test -- --coverage` y `npm run build` en `frontend/`; `npx playwright test` con los cinco proyectos en `e2e/`; `k6 run` en `infra/k6/`.

## 3. Cobertura

### Backend (JaCoCo, líneas)

| Alcance | Cobertura | Mínimo del plan |
|---|---|---|
| Paquetes `application` | 96,4 % (1.886 / 1.957) | 70 % |
| Paquetes `domain` | 97,5 % (691 / 709) | 70 % |
| Total del backend | 96,1 % (4.113 / 4.279) | — |

El build pasa la regla de JaCoCo ("All coverage checks have been met").

### Frontend (Vitest con `@vitest/coverage-v8`)

| Métrica | Cobertura |
|---|---|
| Líneas | 72,03 % (4.688 / 6.508) |
| Sentencias | 70,58 % (6.303 / 8.930) |
| Ramas | 71,70 % (2.671 / 3.725) |
| Funciones | 62,21 % (1.021 / 1.641) |

El plan no pide un porcentaje para el frontend. Pide que cada servicio, guard, interceptor y validador tenga pruebas, y que cada componente de negocio tenga al menos la prueba de render y la de su acción principal. Las funciones quedan por debajo de las demás métricas porque hay plantillas con muchos manejadores pequeños de eventos, que se cubren en las E2E y no en las unitarias.

## 4. E2E y compatibilidad (CP-65)

Corrida del 2026-11-18 contra el entorno `docker-compose.e2e.yml`: Nginx en :4300 y backend con perfil `e2e` en :8081.

| Proyecto | Viewport | Primera corrida | Repetición de los fallidos (2 workers) | Final |
|---|---|---|---|---|
| Chromium | 1440 px | 83 / 90 (7 timeouts) | 7 / 7 | 90 / 90 |
| Firefox | 1440 px | 73 / 90 (17 timeouts) | 17 / 17 | 90 / 90 |
| WebKit | 1440 px | 71 / 90 (16 timeouts, 3 fallos) | 19 / 19 | 90 / 90 |
| Móvil Chromium (Pixel 7) | 375 px | 3 / 3 | — | 3 / 3 |
| Móvil WebKit (iPhone 13) | 375 px | 3 / 3 | — | 3 / 3 |
| **Total** | | **233 / 276 (84,4 %)** | **43 / 43** | **276 / 276** |

**Análisis de la primera corrida.** De los 43 fallos, 40 fueron timeouts de 30 s y 3 fueron esperas de 5 s que vencieron en WebKit: dos encabezados que no aparecieron a tiempo y la recepción solo con teclado. Durante esa corrida la máquina tenía otras tres cargas al mismo tiempo: OWASP Dependency-Check, `npm install` y la medición de cobertura de Vitest. Además, los tres navegadores corrían en paralelo con los workers por defecto. Los 43 pasaron al repetirlos sin cambiar código, así que se clasifican como inestabilidad por carga del equipo y no como defectos. En el CI, cada PR corre solo Chromium y el push a `main` corre los tres navegadores con 2 reintentos.

**CI:** después del merge de F12 (PR #26), el push a `main` corrió las E2E en Chromium, Firefox, WebKit y los dos teléfonos (run 44425815823): en verde.

La suite está organizada por flujos (`auth`, `clientes`, `inventario`, `compras`, `ventas`, `taller`, `notificaciones`, `reportes`, `general`, más `a11y`). No usa esperas fijas (`waitForTimeout`), y los localizadores van por rol y texto accesible.

## 5. Rendimiento (CP-59, CP-60)

Datos del perfil `perf` (`infra/perf/datos-perf.sql`): 12 meses con 500 productos, 1.500 clientes con moto, 3.000 órdenes y 8.000 ventas. Resultados completos en `docs/test-reports/k6/`.

### Operaciones habituales: 8 usuarios virtuales durante 5 minutos (CP-59)

Antes y después de corregir el N+1 del detalle de la orden con `hibernate.default_batch_fetch_size=50`:

| Operación | p95 antes | p95 después |
|---|---|---|
| Login | 1.063 ms | 956 ms |
| Listar órdenes | 94 ms | 121 ms |
| Buscar órdenes | 193 ms | 233 ms |
| Detalle de orden | 361 ms | 141 ms |
| Crear venta | 160 ms | 186 ms |
| Agregar repuesto | 462 ms | 271 ms |
| **Todas** | **390 ms** | **214 ms** |
| Peticiones / errores | 7.237 / 0 % | 8.777 / 0 % |

Umbral: p95 ≤ 2 s y 0 % de errores. **Aprobado.** El login es la operación más lenta por diseño: BCrypt con costo 12. Con 80 repuestos en una orden, el detalle pasó de 89 a 9 sentencias SQL y agregar un repuesto, de 100 a 20. `ItemsPresupuestosIT` evita que el N+1 vuelva: falla si el tamaño de lote baja a 1.

### Reportes sobre 12 meses de datos (CP-60)

Corrida "después" con 4 usuarios virtuales:

| Operación | p95 |
|---|---|
| Dashboard | 347 ms |
| Reporte de servicios | 610 ms |
| Reporte de inventario | 165 ms |
| Reporte de ventas | 913 ms |
| Reporte de ventas en CSV | 872 ms |
| Cuentas pendientes | 113 ms |
| **Todas** | **715 ms** (1.072 peticiones, 0 % de errores) |

Umbral: p95 ≤ 5 s. **Aprobado.** La corrida "antes" (`reportes-antes.json`, p95 de 354 ms) usaba una versión del escenario sin etiquetas por operación y con otra mezcla de reportes, así que no se compara operación por operación.

## 6. Seguridad

La evidencia por punto está en el checklist `docs/test-reports/seguridad-owasp.md` (OWASP Top 10). Resumen:

| Verificación | Resultado |
|---|---|
| Control de acceso (A01): un mecánico con ids de órdenes ajenas en 13 sub-recursos | Nunca 2xx y la orden queda intacta (`SeguridadIT`) |
| Inyección SQL (A03, CP-61): 6 cargas típicas en los parámetros de búsqueda reales de 7 listados y en la búsqueda global; `sort` con SQL | Se tratan como dato; nunca devuelven el listado completo; la tabla `cliente` no cambia; `sort` inválido → 400 `PARAMETRO_INVALIDO` |
| XSS (A03, CP-61) | Un nombre con `<script>` e `<img onerror>` se guarda, se devuelve como JSON y se muestra como texto en el navegador (E2E); el frontend no usa `innerHTML` ni `bypassSecurityTrust*` |
| Autenticación (A07) | Rate limit (sexto login → 429; cuarto pedido de recuperación → 429), rotación del refresh token con revocación de la familia, mensaje genérico |
| Configuración (A05) | En producción: Swagger y OpenAPI → 404, actuator solo `health`, errores sin stacktrace, `ddl-auto=validate` (`ConfiguracionProduccionTest` y verificación en vivo del 2026-11-17) |
| Componentes vulnerables (A06), frontend | `npm audit --omit=dev`: 0 vulnerabilidades (también en `e2e/`) |
| Componentes vulnerables (A06), backend | OWASP Dependency-Check (`./mvnw -Pseguridad dependency-check:check`, 76 dependencias). Primera corrida (2026-11-18): 6 hallazgos. 4 reales en `mysql-connector-j` 9.7.0, el que trae Spring Boot 4.1.2: CVE-2026-60586 (7,7), CVE-2026-60623 (7,1), CVE-2026-60624 (6,5) y CVE-2026-61082 (6,5). 2 falsos positivos por coincidencia de nombre: CVE-2025-7962 en `angus-activation` (es de Jakarta Mail < 2.0.2; Angus Mail está en 2.0.5) y CVE-2025-15104 en `hibernate-validator` (es de validator.nu). Corrección: conector a 26.10.0 (`mysql.version`) y supresiones justificadas en `backend/dependency-check-suppressions.xml`. Segunda corrida: **0 vulnerabilidades** (2 suprimidas), con `./mvnw verify` en verde con el conector nuevo |
| Logs sin datos sensibles (A09) | `infra/scripts/revisar-logs.sh` sobre el log del backend de la corrida E2E del 2026-11-18: 0 contraseñas, hashes, tokens JWT, cabeceras `Authorization`, cookies de refresh, tokens de recuperación ni correos; 0 líneas `ERROR`. Ese log tiene 250 líneas. La revisión anterior, sobre 145.650 líneas, también dio 0 hallazgos |
| Cabeceras HTTPS, HSTS, CSP y puertos (CP-62, CP-63) | No ejecutado: requieren el Nginx y el VPS de F13 |

## 7. Accesibilidad (CP-64)

axe (WCAG 2.1 AA) corre en claro y en oscuro dentro de las E2E, en los tres navegadores de escritorio. Pantallas cubiertas: login con errores, usuarios y su drawer, inventario con los drawers de producto y ajuste, tablero de órdenes en lista y kanban, recepción, servicios, detalle de orden con pestañas y confirmación, punto de venta con carrito, lista, detalle y comprobante de ventas, y dashboard, reportes y configuración. Resultado: **0 violaciones serias o críticas**.

Navegación solo con teclado:
- **Venta de 3 productos (CP-112):** F2 enfoca el buscador, Enter agrega y F9 cobra.
- **Recepción de una moto:** Tab con verificación de `:focus-visible` en cada paso.

Las dos pruebas pasan en los tres navegadores.

## 8. Usabilidad (CP-68)

**No ejecutado.** El guion está listo en `docs/test-reports/usabilidad.md`: 4 tareas (una por rol), métricas de completada, tiempo, errores y comentarios, y una tabla vacía para la sesión con usuarios reales. El criterio es al menos el 80 % de las tareas completadas sin ayuda.

## 9. Defectos

### Encontrados y corregidos en F12 (cada uno con su prueba)

| Defecto | Severidad | Corrección | Prueba |
|---|---|---|---|
| `?sort=` con texto SQL respondía 500 en lugar de 400 | Media | `PARAMETRO_INVALIDO` (400) | `SeguridadIT` (CP-61) |
| N+1 al cargar el detalle de una orden y al agregar repuestos (89 y 100 sentencias) | Media | Carga por lotes de Hibernate (9 y 20 sentencias) | `ItemsPresupuestosIT` |
| Cerrar una pestaña con el stream SSE dejaba un `ERROR` con stacktrace en el log (382 por corrida E2E) | Baja | `GlobalExceptionHandler` ignora la desconexión del cliente | Revisión de logs en el CI |
| Índice duplicado en `movimiento_inventario` (aviso 1831 de MySQL) | Baja | Migración V12 | `./mvnw verify` (Flyway sobre MySQL 8.4) |
| `mysql-connector-j` 9.7.0 con 4 CVE, 2 de severidad alta | Alta | Conector 26.10.0 | Dependency-Check (0 vulnerabilidades) y `./mvnw verify` |
| Falso positivo en la prueba de inyección: un parámetro `q` inexistente en motos y ventas devolvía todo según los datos de otras clases | Baja (de la prueba) | Cargas en los parámetros reales de cada listado y datos propios | `SeguridadIT` |

### Abiertos

No hay issues abiertos en GitHub ni casos fallidos.

Quedan dos observaciones de F11 que no son defectos funcionales:
- Al imprimir desde el tema oscuro, las líneas de la rejilla de las gráficas salen oscuras (siguen siendo legibles).
- La cobertura de funciones del frontend (62 %) es más baja que las demás métricas.

## 10. Pendientes antes de la entrega final

1. **F13:** ejecutar CP-62 (cabeceras en producción), CP-63 (HTTPS y puerto 3306 cerrado), CP-66 (backup y restauración) y CP-67 (despliegue desde cero).
2. **CP-68:** hacer la sesión de usabilidad con usuarios reales y llenar la tabla de `usabilidad.md`.
3. Quitar `mysql.version` del `pom.xml` cuando Spring Boot gestione un conector corregido, y repetir Dependency-Check en cada fase. Con una `NVD_API_KEY` la actualización de la base tarda unos minutos.
