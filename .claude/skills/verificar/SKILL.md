---
name: verificar
description: Ejecuta la verificación completa de HYSKAD antes de cerrar una fase o abrir un PR. Úsalo cuando el usuario lo invoque o al final de cada fase.
---

Ejecuta la verificación completa de HYSKAD y repórtame el resultado en una tabla (Chequeo · Resultado · Detalle):

1. **Backend:** `cd backend && ./mvnw -B verify` (pruebas, ArchUnit, JaCoCo). Reporta número de pruebas y cobertura de `application`/`domain`.
2. **Frontend:** `cd frontend && npm run lint && npm run i18n:check && npm test && npm run build` (omite `i18n:check` si aún no existe).
3. **E2E** (si existen pruebas y el entorno está levantado): `cd e2e && npx playwright test --project=chromium`.
4. **Higiene del código** en los archivos cambiados respecto a `main` (`git diff --name-only main...`):
   - Sin `console.log`, `System.out.println`, `printStackTrace`, `debugger`, código comentado ni `TODO` sin referencia.
   - Sin colores crudos de Tailwind en `frontend/src/app` (`-blue-`, `-gray-`, `-slate-`, `-zinc-`, `-neutral-`).
   - Sin textos visibles sin traducir en plantillas nuevas.
   - Sin secretos (busca `password=`, `secret`, `token` con valores literales, llaves privadas).
   - Sin entidades JPA devueltas por controllers.
5. **Documentación:** `docs/PROGRESS.md` y la columna Estado de `docs/TEST-PLAN.md` actualizados para esta fase.

Si algo falla, corrígelo y vuelve a ejecutar hasta que todo esté en verde. No desactives ni debilites pruebas para que pasen. $ARGUMENTS
