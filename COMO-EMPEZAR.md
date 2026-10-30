# Cómo usar este kit con Claude Code

Este kit es el "cerebro" del proyecto: Claude Code lo lee para saber qué construir, cómo y en qué orden. Tú solo vas lanzando las fases y aprobando.

## 1. Preparar la carpeta (una sola vez)

1. Crea una carpeta vacía llamada `hyskad` donde guardes tus proyectos.
2. Copia **todo** el contenido del kit dentro de ella. Ojo: `.claude` es una carpeta oculta; si no la ves, activa "mostrar archivos ocultos" (en Windows: Explorador → Vista → Elementos ocultos).

   ```
   hyskad/
   ├── CLAUDE.md
   ├── COMO-EMPEZAR.md
   ├── .claude/skills/  (fase, continuar, verificar)
   ├── brand/  (logo en SVG, íconos, favicons; en F01 se mueve al frontend)
   └── docs/  (ARCHITECTURE, BUSINESS-RULES, DESIGN-SYSTEM, TEST-PLAN, PROGRESS, prompts/)
   ```
3. El logo ya viene listo en `brand/`; no tienes que hacer nada con él.

## 2. Ejecutar las fases

Abre una terminal **dentro** de la carpeta `hyskad` y escribe `claude`. Luego:

```
/fase F00
```

Cuando termine y esté en verde, sigue con la siguiente. El orden es:

`F00 → F01 → F02 → F03 → F04A → F04B → F05 → F06 → F07 → F08 → F09A → F09B → F09C → F10 → F11 → F12 → F13`

En cada fase Claude Code:
1. Te muestra un plan corto → tú respondes "ok" (o le corriges algo).
2. Programa, hace pruebas y commits.
3. Ejecuta `/verificar`.
4. Abre un Pull Request en GitHub, espera el CI y hace el merge.

Si quieres que algo se vea o funcione distinto, díselo en ese momento con tus palabras; ya tiene todo el contexto.

## 3. Consejos para el plan Pro

El plan Pro tiene límites de uso por ventana de tiempo, y las fases son grandes. Para rendir:

- **Una fase por sesión.** Al terminar una, escribe `/clear` antes de la siguiente para empezar con contexto limpio (CLAUDE.md y PROGRESS.md le devuelven el contexto necesario).
- **Si se corta por el límite o cierras la terminal:** cuando vuelvas, abre `claude` y escribe `/continuar`. Leerá `PROGRESS.md` y git para seguir donde quedó.
- Las fases más pesadas son F04A, F09B y F12. Es normal que te tomen más de una sesión.
- Si una respuesta se va por las ramas, presiona `Esc` para detenerla y redirígela.

## 4. Git sin saber Git

Claude Code maneja Git por ti. Lo mínimo para entender lo que hace:

| Término | Qué es |
|---|---|
| **Commit** | Un punto de guardado con descripción ("agregué el login") |
| **Rama** (`feature/f05-...`) | Una copia de trabajo para una fase, para no dañar lo que ya funciona |
| **Pull Request (PR)** | La solicitud de unir la rama a `main`; ahí corren las pruebas automáticas |
| **CI** | GitHub ejecuta todas las pruebas en cada PR; si algo falla, no se une |
| **Merge** | Unir la rama a `main` cuando todo está en verde |
| **Tag** (`v1.0.0`) | Marca una versión; en F13 dispara el despliegue al VPS |

Puedes ver todo el historial en tu repositorio de GitHub, en la pestaña *Pull requests*.

## 5. Prompts útiles fuera de las fases

**Encontraste un error:**
```
Encontré este error: <describe qué hiciste, qué esperabas y qué pasó; pega el mensaje o la captura>.
Reprodúcelo primero con una prueba que falle, luego corrígelo, verifica con /verificar
y haz commit con "fix(<modulo>): ...". Si cambia alguna regla de negocio, pregúntame antes.
```

**Quieres cambiar algo de diseño:**
```
Quiero cambiar <qué> en <pantalla>. Respeta docs/DESIGN-SYSTEM.md; si el cambio implica
un token o componente nuevo, agrégalo primero ahí. Muéstrame capturas en claro/oscuro y móvil.
```

**Quieres entender algo para la sustentación:**
```
Explícame en lenguaje sencillo cómo funciona <el refresh token / la máquina de estados /
la reserva de stock> en HYSKAD, mostrando los archivos y líneas clave. No cambies código.
```

## 6. Decisiones que tomé por ti (para que las puedas defender)

| Tema | Decisión | Por qué |
|---|---|---|
| Versiones | Java 25, Spring Boot 4.x, **Angular 22**, Tailwind v4, MySQL 8.4, Node 24 | En Angular, "LTS" es la fase de solo parches de seguridad; la 22 es la versión activa más reciente con soporte completo |
| Migraciones | Flyway | El esquema queda versionado en SQL, reproducible y auditable |
| Tokens | Access JWT de 15 min en memoria + refresh en cookie `HttpOnly` con rotación | Un ataque XSS no puede robar el refresh, y un token robado se detecta |
| Gráficas | Chart.js con un componente propio | Liviana, conocida y fácil de adaptar al tema claro/oscuro |
| Comprobantes | Vista imprimible en el navegador (Imprimir / Guardar como PDF) | Lo más simple de construir y de explicar |
| Costo de productos | Costo promedio ponderado | Es lo que cuesta en promedio cada unidad cuando compras el mismo repuesto a precios distintos; sirve para calcular la ganancia real |
| IVA | 19 % configurable, precios registrados sin IVA | Se puede cambiar sin tocar código y los documentos viejos no se alteran |
| Repuestos en órdenes | Se reservan al agregarlos y se descuentan al finalizar | Así no se venden en mostrador repuestos que ya están comprometidos para una moto |
| Presupuestos | Uno pendiente a la vez, con versiones; rechazo = orden cancelada | Lo más sencillo que cubre RF22–RF23 |
| Tiempo real | SSE (Server-Sent Events) | Las notificaciones solo van del servidor al navegador; SSE es más simple que WebSockets para eso |
| Correo | Mailpit en desarrollo; SMTP externo en producción (Brevo o Gmail con contraseña de aplicación) | Pruebas sin enviar correos reales |
| Auditoría | Tabla propia escrita desde los servicios | Más fácil de explicar y controlar que Hibernate Envers |
| Patrones | Máquina de estados (órdenes), Observer con eventos (notificaciones), Specification (filtros), inversión de dependencias (evitar un ciclo) | Cada uno resuelve un problema concreto; ninguno "por si acaso" |

Si alguna no te convence, cámbiala en `docs/BUSINESS-RULES.md` o `docs/ARCHITECTURE.md` **antes** de llegar a la fase que la usa.
