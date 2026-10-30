# F04B — Sesión, guards y administración de usuarios (frontend)

**Rama:** `feature/f04b-sesion-usuarios`
**Requisitos:** RF1, RF2, RF3, RF4, RF35 · IU1, IU3, IU4, IU5 · IC3
**Lee antes:** `CLAUDE.md`, `docs/ARCHITECTURE.md` §5 y §8, `docs/DESIGN-SYSTEM.md` §7 (Login)

## Prompt

Ejecuta la fase F04B de HYSKAD: conectar el frontend con la autenticación de F03 y construir la administración de usuarios. Muéstrame un plan corto y espera mi OK.

### 1. Sesión (`core/auth`)
- `AuthService` con signals: `usuario`, `permisos`, `estaAutenticado`, `tienePermiso(p)`. Access token **solo en memoria**.
- Al iniciar la app (`provideAppInitializer`) intenta `POST /auth/refresh` para recuperar la sesión; mientras, muestra un splash con el logo.
- Interceptor funcional: agrega `Authorization`, `withCredentials` en `/auth/*`, y ante 401 hace **un único** refresh compartido por todas las peticiones en vuelo y las reintenta; si el refresh falla, cierra sesión y redirige a login guardando la URL de retorno.
- Refresco proactivo un minuto antes de que expire el access token.
- Interceptor de errores: traduce `code` del `ProblemDetail` a un toast (`errors.<CODE>`) salvo que el componente indique que lo maneja él; marca errores de validación en el formulario cuando vengan `errors[]`.
- Guards: `authGuard`, `invitadoGuard` (login no accesible si ya hay sesión) y `permisoGuard(...permisos)` para `canMatch`.
- Directiva estructural `*hkTienePermiso="'VENTAS_CREAR'"` para mostrar/ocultar acciones.
- El menú y la barra inferior móvil se filtran por permisos.
- Si `debeCambiarPassword` es `true`, obliga a pasar por la pantalla de cambio de contraseña.

### 2. Pantallas
- **Login** según `DESIGN-SYSTEM.md` §7: pantalla dividida, mostrar/ocultar contraseña, errores claros, estado de carga, manejo del 429 mostrando cuánto esperar, selector de idioma y tema.
- **Olvidé mi contraseña** y **Restablecer contraseña** (lee `token` de la URL, medidor de fortaleza que refleja la política).
- **Mi perfil**: datos propios, idioma preferido (se guarda en backend) y cambio de contraseña.
- **Usuarios** (solo `USUARIOS_GESTIONAR`): tabla con búsqueda, filtros por rol y estado, avatar, badge de rol y de estado; crear/editar en `hk-drawer`; activar/desactivar con confirmación; pantalla de **permisos** del usuario agrupados por módulo, con switches que muestran si el permiso viene del rol y deshabilitan los no editables.
- Menú de usuario de la topbar con nombre, rol, perfil y cerrar sesión.

### 3. E2E en CI
- Agrega al CI un job `e2e` que levante MySQL con un `docker compose` de pruebas, el backend con perfil `e2e` (crea el endpoint `POST /api/v1/test/reset` **solo** en ese perfil, ver `TEST-PLAN.md` §4) y el frontend compilado, y ejecute Playwright en Chromium (los tres navegadores se corren en F12). Guarda el reporte como artefacto si falla.

### Pruebas obligatorias
- Unitarias: `AuthService`, interceptor de auth (incluido CP-04: un solo refresh para varias peticiones simultáneas con 401), interceptor de errores, guards, directiva de permisos, formularios de usuario (validaciones).
- E2E: CP-01, CP-04, CP-09 (UI), login fallido, recuperación de contraseña completa leyendo el correo desde la API de Mailpit, cerrar sesión, acceso directo por URL a una ruta sin permiso (redirige a 403/inicio).
- Accesibilidad: axe en login y usuarios (claro y oscuro).

### Criterios de aceptación
- [ ] Recargar la página mantiene la sesión sin guardar el token en `localStorage`/`sessionStorage` (verifícalo en la prueba E2E).
- [ ] Un mecánico no ve "Usuarios" en el menú y si escribe la URL no entra.
- [ ] Capturas del login y la gestión de usuarios en claro/oscuro y móvil.
- [ ] CI con los jobs backend, frontend y e2e en verde. `PROGRESS.md` y `TEST-PLAN.md` actualizados. Merge.
