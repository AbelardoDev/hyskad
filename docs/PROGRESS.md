# Progreso de HYSKAD

> Claude Code actualiza este archivo al **cerrar cada fase** y cuando una sesión se interrumpe. Es la memoria del proyecto entre sesiones.

## Estado de las fases

| Fase | Nombre | Estado | PR | Notas |
|---|---|---|---|---|
| F00 | Preparación del entorno | ✅ Terminada | — | Entorno verificado 2026-10-29 |
| F01 | Monorepo, infraestructura local y CI | ✅ Terminada | #1 | Repo público AbelardoDev/hyskad; `main` protegida por el CI |
| F02 | Base del backend | 🟦 En curso | | |
| F03 | Autenticación, usuarios y permisos (backend) | ⬜ Pendiente | | |
| F04A | Sistema de diseño, tema, i18n y layout | ⬜ Pendiente | | |
| F04B | Sesión, guards y administración de usuarios (frontend) | ⬜ Pendiente | | |
| F05 | Clientes y motocicletas | ⬜ Pendiente | | |
| F06 | Catálogo de productos e inventario | ⬜ Pendiente | | |
| F07 | Proveedores y compras | ⬜ Pendiente | | |
| F08 | Ventas y comprobantes | ⬜ Pendiente | | |
| F09A | Órdenes: creación, asignación, estados y diagnóstico | ⬜ Pendiente | | |
| F09B | Órdenes: servicios, repuestos y presupuestos | ⬜ Pendiente | | |
| F09C | Órdenes: pago, entrega, historial y vista del mecánico | ⬜ Pendiente | | |
| F10 | Notificaciones en tiempo real, correos y auditoría | ⬜ Pendiente | | |
| F11 | Reportes, dashboard, búsqueda global y configuración | ⬜ Pendiente | | |
| F12 | Calidad: E2E, accesibilidad, rendimiento y seguridad | ⬜ Pendiente | | |
| F13 | Despliegue en VPS | ⬜ Pendiente | | |

Leyenda: ⬜ Pendiente · 🟦 En curso · ✅ Terminada

## Sesión actual / última sesión

- **Fase:** F02 🟦 (implementación y verificación local terminadas; falta PR, CI y merge)
- **Rama:** `feature/f02-backend-base`
- **Hecho:** `shared` completo: `BaseEntity` + JPA Auditing con `Clock`, `PageResponse` (máx. 100), errores con `ProblemDetail` (`type` URN, `code`, `requestId`, `errors[]`), `ConsecutivoService` (PESSIMISTIC_WRITE, propagación MANDATORY), `@PlacaColombiana` y `@DocumentoValido` (DV NIT), `Normalizador`, Jackson estricto, OpenAPI en `/api/docs` (dev/test), async acotado con MDC, CORS dev, filtro `X-Request-Id`, logs ECS en prod, seguridad base (todo autenticado salvo health y docs; 401/403 como ProblemDetail). Módulo `configuracion` (caché invalidada al confirmar) y `AuditoriaService`. Migración `V1__sistema.sql`. `ArquitecturaTest` genérico. Se eliminó el ping (backend, frontend y E2E). Pruebas: 76 unitarias + 27 de integración (failsafe) + Vitest + E2E.
- **Siguiente paso concreto:** abrir el PR de F02, esperar el CI y hacer merge; luego `/fase F03`.
- **Bloqueos o dudas:** ninguno. MySQL80 local quedó detenido y en arranque manual a pedido del usuario.

## Decisiones tomadas durante el desarrollo

<!-- Formato: AAAA-MM-DD · Fase · Decisión · Motivo -->
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
- La página de inicio temporal no usa tokens del sistema de diseño ni tiene modo oscuro (llegan en F04A).
- Aviso de Mockito por auto-attach del agente en las pruebas del backend (JDK 25); sin impacto por ahora.
