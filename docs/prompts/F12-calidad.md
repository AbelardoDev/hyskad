# F12 — Calidad: E2E, accesibilidad, rendimiento, seguridad e informe de pruebas

**Rama:** `feature/f12-calidad`
**Requisitos:** Objetivo específico 4 (≥ 90 % de casos aprobados) · RNF Rendimiento, Seguridad, Accesibilidad, Compatibilidad, Calidad, Usabilidad
**Lee antes:** `CLAUDE.md`, `docs/TEST-PLAN.md` completo, `docs/PROGRESS.md`

## Prompt

Ejecuta la fase F12 de HYSKAD: endurecer el sistema y demostrar su calidad con evidencia. No agregues funcionalidades nuevas; si encuentras defectos, corrígelos con su prueba. Muéstrame un plan corto y espera mi OK.

### 1. Inventario de pruebas
- Recorre `TEST-PLAN.md` y verifica que cada caso `CP-*` automatizable tenga al menos una prueba que lo referencie (usa el ID en el nombre o en un comentario `// CP-xx`). Genera una tabla de faltantes y complétalos.

### 2. E2E y compatibilidad
- Organiza la suite Playwright por flujos: autenticación, clientes/motos, inventario, compras, ventas, taller completo, notificaciones, reportes.
- Ejecuta en Chromium, Firefox y WebKit (CP-65) y en viewports de escritorio (1440) y móvil (375, emulando un teléfono).
- Elimina esperas fijas (`waitForTimeout`); usa localizadores por rol y texto accesible.
- Configura el CI para correr Chromium en cada PR y los tres navegadores en `push` a `main`.

### 3. Accesibilidad (CP-64)
- axe en login, dashboard, tablero de órdenes, detalle de orden, punto de venta, productos y usuarios, en claro y oscuro. Corrige todas las violaciones serias y críticas.
- Prueba de navegación solo con teclado del flujo de venta y de recepción de moto.

### 4. Rendimiento (CP-59, CP-60)
- Script de carga de datos masivos para el perfil `perf` (12 meses: ~3.000 órdenes, ~8.000 ventas, 500 productos, 1.500 clientes).
- Scripts k6 en `infra/k6/`: escenario de operaciones habituales con 8 usuarios virtuales durante 5 min (login, listar/buscar órdenes, ver detalle, crear venta, agregar repuesto) con umbral p95 ≤ 2 s y 0 % de errores; escenario de reportes con p95 ≤ 5 s.
- Si algo no cumple: revisa N+1 (activa estadísticas de Hibernate en el perfil `perf`), índices, paginación y proyecciones DTO. Documenta antes/después.

### 5. Seguridad
- Checklist OWASP Top 10 aplicado a HYSKAD con evidencia por punto (prueba o explicación): control de acceso (incluye pruebas IDOR: un mecánico con ids de órdenes ajenas), inyección (CP-61, prueba con payloads típicos en búsquedas y formularios), autenticación (rate limit, rotación de tokens), configuración (Swagger desactivado en `prod`, actuator restringido, errores sin stacktrace), componentes vulnerables (`npm audit --omit=dev` sin altas/críticas, dependencias Maven revisadas con el plugin OWASP Dependency-Check o equivalente), XSS (Angular escapa por defecto: verifica que no haya `innerHTML`/`bypassSecurityTrust*`).
- Revisa que ningún log contenga datos sensibles (grep en los logs de una corrida E2E completa).

### 6. Usabilidad (CP-68)
- Prepara `docs/test-reports/usabilidad.md`: guion de 4 tareas (una por rol), métricas (completada sí/no, tiempo, errores, comentarios) y una tabla vacía para que yo la llene con usuarios reales.

### 7. Informe
- Genera `docs/test-reports/INFORME-PRUEBAS.md` según `TEST-PLAN.md` §7, con datos reales de las corridas (no inventes números: si algo no se ejecutó, márcalo como no ejecutado). Incluye el porcentaje de aprobación y la conclusión frente al 90 %.
- Actualiza la columna Estado de todos los casos en `TEST-PLAN.md`.

### Criterios de aceptación
- [ ] ≥ 90 % de casos aprobados y ningún caso de prioridad Alta fallido en seguridad, inventario, pagos o integridad.
- [ ] CI completo en verde con los tres navegadores.
- [ ] Informe de pruebas y checklist de seguridad en `docs/`.
- [ ] `PROGRESS.md` actualizado. PR, CI verde, merge.
