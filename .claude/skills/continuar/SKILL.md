---
name: continuar
description: Retoma el trabajo de HYSKAD donde quedó la sesión anterior. Úsalo solo cuando el usuario lo invoque.
disable-model-invocation: true
---

Retoma el trabajo de HYSKAD donde quedó.

1. Lee `docs/PROGRESS.md` (sección "Sesión actual / última sesión") y el prompt de la fase en curso en `docs/prompts/`.
2. Revisa `git status`, `git log --oneline -15` y la rama actual para confirmar qué está hecho de verdad (el código manda sobre las notas).
3. Ejecuta las pruebas del área en la que se estaba trabajando para conocer el estado real.
4. Dame un resumen de máximo 8 líneas: qué está hecho, qué falta de la fase y cuál es el siguiente paso concreto. Espera mi OK y continúa.

$ARGUMENTS
