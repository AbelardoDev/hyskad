# Progreso de HYSKAD

> Claude Code actualiza este archivo al **cerrar cada fase** y cuando una sesión se interrumpe. Es la memoria del proyecto entre sesiones.

## Estado de las fases

| Fase | Nombre | Estado | PR | Notas |
|---|---|---|---|---|
| F00 | Preparación del entorno | ✅ Terminada | — | Entorno verificado 2026-10-29 |
| F01 | Monorepo, infraestructura local y CI | ✅ Terminada | #1 | Repo público AbelardoDev/hyskad; `main` protegida por el CI |
| F02 | Base del backend | ✅ Terminada | #7 | Swagger en /api/docs (dev) |
| F03 | Autenticación, usuarios y permisos (backend) | ✅ Terminada | #8 | Usuarios dev en el README |
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

- **Fase:** F03 ✅ (cerrada 2026-10-29, PR #8)
- **Rama:** `feature/f03-auth-usuarios` → `main`
- **Hecho:** módulo `usuarios` (`Usuario`, `UsuarioPermiso`, `Rol`, `Permiso` con marca solo admin, `PermisosPorRol` = tabla de ARCHITECTURE §5, `PermisoService`, `UsuarioService` con RN-46/47/48, `CuentaService` para auth, `AdminInicialRunner`) y módulo `auth` (JWT HS256 con Nimbus, refresh opaco hasheado con rotación y revocación de la familia ante reúso, cookie `hk_refresh`, recuperación de contraseña de 30 min y un solo uso con correo Thymeleaf es/en, rate limiting con Bucket4j). En `shared`: `UsuarioActual`, `JwtConfig` (BCrypt 12, converter `permisos` → authorities sin prefijo), `AuditorAware` real, `@PasswordSegura`, `CorreoService`, 429 con `Retry-After`, 400 para `sort` inválido. Migraciones `V2` (`debe_cambiar_password`) y `db/dev-data/R__usuarios_dev.sql` (solo dev). Pruebas: 113 unitarias + 74 de integración (GreenMail para correos); cobertura de `auth.application` 92,9 % y de `usuarios.application` 98,5 %. Verificado a mano en dev: admin → `/usuarios` 200, mecánico 403, correo de recuperación en Mailpit con el enlace correcto, logs sin secretos.
- **Siguiente paso concreto:** iniciar F04A con `/fase F04A`. Revisar los PRs de dependabot abiertos.
- **Bloqueos o dudas:** ninguno.

## Decisiones tomadas durante el desarrollo

<!-- Formato: AAAA-MM-DD · Fase · Decisión · Motivo -->
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
- `debeCambiarPassword` no bloquea otros endpoints en el backend: lo hace cumplir el frontend (F04B).
- La página de inicio temporal no usa tokens del sistema de diseño ni tiene modo oscuro (llegan en F04A).
- Aviso de Mockito por auto-attach del agente en las pruebas del backend (JDK 25); sin impacto por ahora.
