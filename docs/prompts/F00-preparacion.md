# F00 — Preparación del entorno

**Objetivo:** confirmar que la máquina tiene todo lo necesario antes de escribir código. No crea código del proyecto.

## Prompt

Vamos a iniciar el proyecto HYSKAD. Lee `CLAUDE.md` y `docs/PROGRESS.md`. En esta fase **no escribas código del proyecto**; solo verifica el entorno.

1. Detecta mi sistema operativo y verifica estas herramientas, mostrando la versión de cada una en una tabla (Herramienta · Requerida · Instalada · OK/Falta):
   - Java **25** (JDK, preferiblemente Eclipse Temurin). `JAVA_HOME` apuntando a ese JDK.
   - Node.js **24 LTS** y npm.
   - Git (y que tenga configurados `user.name` y `user.email`).
   - GitHub CLI (`gh`) autenticado (`gh auth status`).
   - Docker y Docker Compose v2, con el daemon corriendo (`docker info`).
   - Que los puertos 3306, 8080, 4200, 1025 y 8025 estén libres.
2. Para cada cosa que falte o esté en una versión distinta, dame el comando exacto de instalación para mi sistema operativo. **No instales nada sin preguntarme.**
3. Si todo está bien, actualiza `docs/PROGRESS.md` marcando F00 como ✅ y dime que puedo seguir con F01.

## Criterios de aceptación
- [ ] Tabla de verificación completa, todo en OK.
- [ ] `docs/PROGRESS.md` actualizado.
