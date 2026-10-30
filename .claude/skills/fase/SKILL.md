---
name: fase
description: Ejecuta una fase del plan de HYSKAD (ej. /fase F05). Úsalo solo cuando el usuario lo invoque.
disable-model-invocation: true
---

Vas a ejecutar la fase **$ARGUMENTS** de HYSKAD.

1. Lee `CLAUDE.md` (ya está en contexto) y `docs/PROGRESS.md`.
2. Busca el prompt de la fase en `docs/prompts/` (el archivo que empieza por `$ARGUMENTS-`) y léelo completo, junto con los documentos de su sección "Lee antes".
3. Verifica que la fase anterior esté ✅ en `PROGRESS.md` y que `main` esté al día (`git checkout main && git pull`). Si algo no cuadra, avísame antes de seguir.
4. Marca la fase como 🟦 En curso en `PROGRESS.md`, crea la rama indicada en el prompt y sigue sus instrucciones al pie de la letra, empezando por presentarme el plan corto y esperar mi aprobación.
5. Al terminar, ejecuta la skill de verificación (`/verificar`) y cumple el "Flujo de trabajo de cada fase" de `CLAUDE.md` hasta el merge.
