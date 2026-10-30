# F03 — Autenticación, usuarios y permisos (backend)

**Rama:** `feature/f03-auth-usuarios`
**Requisitos:** RF1, RF2, RF3, RF4, RF35 · IS4, IC3, IC5, IC6 · RNF Seguridad, Privacidad, Trazabilidad · RN-46 a RN-51
**Lee antes:** `CLAUDE.md` (sección Seguridad), `docs/ARCHITECTURE.md` §5, §7 (correo), `docs/BUSINESS-RULES.md` §8 y §10

## Prompt

Ejecuta la fase F03 de HYSKAD: seguridad, autenticación y gestión de usuarios en el backend. Lee los documentos indicados. Muéstrame un plan corto y espera mi OK.

### 1. Modelo y permisos
- Entidad `Usuario` (rol como enum `Rol`), `UsuarioPermiso`, enum `Permiso` y `PERMISOS_POR_ROL` exactamente como la tabla de `ARCHITECTURE.md` §5, incluido qué permisos son *solo admin*.
- `PermisoService.permisosEfectivos(usuario)` = permisos del rol + concedidos − retirados.

### 2. Tokens y sesión
- **Access token**: JWT firmado por el backend (HS256 con `JWT_SECRET` de ≥ 256 bits) usando `NimbusJwtEncoder`/`NimbusJwtDecoder` de Spring Security (sin librerías JWT de terceros). Claims: `sub` (id), `email`, `nombre`, `rol`, `permisos` (lista), `iat`, `exp` (15 min), `iss`. El `JwtAuthenticationConverter` mapea `permisos` a authorities **sin** prefijo.
- **Refresh token**: valor aleatorio de 256 bits (`SecureRandom`, Base64URL), guardado como SHA-256 en `refresh_token`, vigencia 7 días, en cookie `hk_refresh` `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` (en `dev` `Secure` puede ir desactivado por configuración).
- **Rotación**: cada `/auth/refresh` revoca el token usado y emite otro (`reemplazado_por`). Si llega un token ya revocado → se revoca toda la cadena del usuario (posible robo) y se responde 401 (CP-05).
- Endpoints:
  - `POST /auth/login` → `{ accessToken, expiresIn, usuario: {id, nombre, email, rol, permisos, idioma, debeCambiarPassword} }` + cookie.
  - `POST /auth/refresh` → mismo cuerpo, nuevo access y nueva cookie.
  - `POST /auth/logout` → revoca el refresh actual y borra la cookie.
  - `GET /auth/me` → datos del usuario autenticado.
  - `POST /auth/password/cambiar` (autenticado: actual + nueva).
  - `POST /auth/password/olvide` y `POST /auth/password/restablecer` (RF35, RN-50): enlace `${APP_BASE_URL}/restablecer?token=...`, 30 min, un solo uso; correo con plantilla Thymeleaf bilingüe según `usuario.idioma`.
- **Rate limiting** con Bucket4j (en memoria): login 5/min por IP+email; refresh 30/min por IP; olvidé contraseña 3/15 min por IP+email. Respuesta 429 con `Retry-After`.
- `SecurityFilterChain`: stateless, CSRF deshabilitado para la API (seguro porque el access token va en la cabecera y la cookie de refresh es `SameSite=Strict` y solo aplica a `/auth`), públicos solo `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password/olvide`, `/auth/password/restablecer`, `/actuator/health` y la documentación en `dev`. Respuestas 401/403 en formato `ProblemDetail`.
- Cabeceras de seguridad por defecto de Spring Security activas.
- Completa el `AuditorAware` de F02 y un `UsuarioActual` (helper para obtener id, permisos e IP).

### 3. Gestión de usuarios (solo `USUARIOS_GESTIONAR`)
- `GET /usuarios` (paginado, filtros por texto, rol y estado), `GET /usuarios/{id}`, `POST /usuarios`, `PUT /usuarios/{id}`, `PATCH /usuarios/{id}/estado`, `GET/PUT /usuarios/{id}/permisos` (devuelve por cada permiso: si viene del rol, si está concedido/retirado y si es editable).
- Reglas RN-46, RN-47, RN-48. Para RN-48 sin crear un ciclo `usuarios ↔ auth`: `usuarios` publica el evento `AccesoUsuarioModificado(usuarioId)` y `auth` lo escucha (en la misma transacción) para revocar los refresh tokens. Política de contraseña (8+ caracteres, letras y números) en un validador reutilizable.
- `PUT /auth/me/preferencias` para que cada usuario guarde su `idioma`.
- **Admin inicial** (RN-46): `ApplicationRunner` que, si no hay ningún ADMIN, lo crea con `ADMIN_EMAIL`/`ADMIN_PASSWORD` y `debeCambiarPassword=true`. Si faltan las variables, registra un error claro y no crea nada.
- Auditoría (RN-51) de: login exitoso y fallido, logout, creación/edición/cambio de estado de usuario, cambios de permisos, restablecimiento de contraseña.
- Migración `V2__...` solo si necesitas ajustar algo de V1 (nunca editar V1).

### 4. Datos de desarrollo
- Migración de datos **solo para `dev`** (`db/dev-data/R__usuarios_dev.sql` o equivalente) con un usuario por rol y contraseña conocida documentada en el README (solo para desarrollo).

### Pruebas obligatorias
CP-01, CP-02, CP-03, CP-05, CP-06, CP-07, CP-08, CP-10, CP-11, CP-12, CP-13, y además:
- Unitarias de `PermisoService` (combinaciones de concedidos/retirados) y del validador de contraseña.
- Cada endpoint de `/usuarios` probado con un usuario sin permiso (403) y sin token (401).
- Rotación del refresh token: el viejo deja de servir, el nuevo sí.
- Que la cookie tenga `HttpOnly`, `SameSite=Strict` y `Path` correctos.
- Correos verificados con GreenMail (o Testcontainers + Mailpit) en las pruebas de integración.

### Criterios de aceptación
- [ ] Desde Swagger: login → copiar token → llamar `/usuarios` como admin funciona; como mecánico da 403.
- [ ] El correo de recuperación llega a Mailpit con el enlace correcto.
- [ ] Ninguna respuesta ni log contiene contraseñas, hashes ni tokens.
- [ ] `./mvnw verify` en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. PR, CI verde, merge.
