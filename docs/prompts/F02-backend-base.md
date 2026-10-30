# F02 — Base del backend

**Rama:** `feature/f02-backend-base`
**Requisitos:** IS2, IS3, IC2 · RNF Mantenibilidad, Integridad, Observabilidad, Trazabilidad · RN-52, RN-53
**Lee antes:** `CLAUDE.md`, `docs/ARCHITECTURE.md` §2, §3 (tablas de sistema), §4, §6, §10

## Prompt

Ejecuta la fase F02 de HYSKAD: la base transversal del backend sobre la que se apoyan todos los módulos. Lee los documentos indicados arriba. Muéstrame un plan corto y espera mi OK.

### Alcance

1. **Paquete `shared`** según `ARCHITECTURE.md` §2:
   - `BaseEntity` (`@MappedSuperclass`) con `id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` usando JPA Auditing (`AuditorAware` que por ahora devuelve vacío; en F03 leerá el usuario autenticado). Un `Clock` inyectable (bean) para poder fijar el tiempo en pruebas.
   - `PageResponse<T>` y utilidad para convertir `Page<T>`; límite máximo `size=100`.
   - Manejo de errores: `ErrorCode` (enum con código y status HTTP), `BusinessException`, `NotFoundException`, `ConflictException`, y `GlobalExceptionHandler` (`@RestControllerAdvice`) que devuelva `ProblemDetail` con `code` y, para validación, `errors: [{campo, code}]`. Cubre: validación de cuerpo y parámetros, JSON mal formado, tipo de parámetro inválido, 404 de ruta, 405, `AccessDenied` (403), `OptimisticLockException` (409 `CONFLICTO_CONCURRENCIA`), `DataIntegrityViolationException` (409) y genérico 500 (sin filtrar detalles internos).
   - `ConsecutivoService` (tabla `consecutivo`, lectura con `PESSIMISTIC_WRITE`, formato `PREFIJO-000001`, participa en la transacción del llamador). RN-52.
   - Validadores reutilizables: `@PlacaColombiana` y `@DocumentoValido` (a nivel de clase: valida `numero_documento` según `tipo_documento`, incluido el DV del NIT). Reglas en `BUSINESS-RULES.md` RN-38, RN-39, RN-41. Normalizadores (mayúsculas, sin espacios/guiones) en una clase utilitaria.
   - Configuración: Jackson (fechas ISO, `Instant` en UTC, y que **rechace propiedades desconocidas** en el JSON de entrada para detectar errores de contrato), OpenAPI (título, versión, esquema de seguridad Bearer JWT; Swagger UI en `/api/docs` solo en `dev`/`test`), `@EnableAsync` con un `ThreadPoolTaskExecutor` acotado, CORS solo para el perfil `dev` (`http://localhost:4200`, con credenciales).
   - Logging: filtro que asigna un `requestId` (o toma `X-Request-Id`) al MDC y lo devuelve en la respuesta; formato JSON en `prod` (Logback con encoder estructurado nativo de Spring Boot).
2. **Módulo `configuracion`:** entidad `Configuracion` (clave/valor), servicio con caché simple en memoria invalidada al actualizar, y getters tipados (`getIvaPorcentaje()`, `getDatosTaller()`). El endpoint llega en F11.
3. **Auditoría (infraestructura):** entidad `Auditoria`, `AuditoriaService.registrar(accion, entidad, entidadId, detalle)` que toma usuario e IP del contexto (vacíos por ahora). Se usará desde los servicios en cada módulo.
4. **Migraciones Flyway:**
   - `V1__sistema.sql`: `usuario`, `usuario_permiso`, `refresh_token`, `token_recuperacion`, `auditoria`, `configuracion` (con valores iniciales de RN-03 y datos de taller de ejemplo), `consecutivo` (OT, VENTA, COMPRA, PRESUPUESTO).
   - Índices y claves foráneas explícitos con nombres (`fk_usuario_permiso_usuario`, `ix_auditoria_entidad`...). `ENGINE=InnoDB`, `utf8mb4`.
5. Elimina el `PingController` de F01 y su página; el frontend temporal muestra solo "HYSKAD".
6. **ArchUnit** (`ArquitecturaTest`): las reglas de `ARCHITECTURE.md` §2 escritas de forma genérica para que apliquen automáticamente a los módulos futuros.

### Pruebas obligatorias
- `GlobalExceptionHandler`: una prueba de integración por tipo de error (usa un controller de prueba solo en `src/test`).
- `ConsecutivoService`: secuencia correcta y sin duplicados con 10 hilos concurrentes.
- Validador de placa (CP-17, parte backend) y de documentos con casos parametrizados (CP-15 parte unitaria), incluidos NIT válidos e inválidos reales de ejemplo.
- Flyway aplica sobre MySQL vacío en Testcontainers y `ddl-auto=validate` arranca sin errores.
- `ArquitecturaTest` en verde.

### Criterios de aceptación
- [ ] `./mvnw verify` en verde con JaCoCo activo.
- [ ] Swagger UI accesible en `http://localhost:8080/api/docs` en `dev`.
- [ ] Un error de validación devuelve `ProblemDetail` con `code` y `errors[]` (muéstrame un ejemplo de respuesta).
- [ ] `docs/PROGRESS.md` y `docs/TEST-PLAN.md` actualizados. PR abierto, CI en verde, merge.
