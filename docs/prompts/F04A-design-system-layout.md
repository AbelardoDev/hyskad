# F04A — Sistema de diseño, tema claro/oscuro, i18n y layout

**Rama:** `feature/f04a-design-system`
**Requisitos:** IU1, IU2, IU4, IU6, IU7 · IH2 · RNF Usabilidad, Compatibilidad, Accesibilidad, Mantenibilidad
**Lee antes:** `CLAUDE.md`, `docs/DESIGN-SYSTEM.md` (completo), `docs/ARCHITECTURE.md` §8

## Prompt

Ejecuta la fase F04A de HYSKAD: el sistema de diseño y el esqueleto visual de la app. Esta fase define cómo se ve y se siente todo el producto, así que el nivel de detalle visual importa tanto como el código. Lee `docs/DESIGN-SYSTEM.md` completo. Muéstrame un plan corto y espera mi OK.

### 1. Fundamentos
- Tokens completos en `styles.css` según `DESIGN-SYSTEM.md` §1.4: escala `brand`, `navy`, `accent` y **todos** los tokens semánticos en claro y oscuro con `@theme inline`. Verifica con una utilidad o prueba que cada par texto/fondo principal cumple contraste AA en ambos temas.
- Fuentes con `@fontsource-variable/inter` y `@fontsource-variable/plus-jakarta-sans`.
- Íconos con `lucide-angular` (registra solo los íconos usados).
- Logo: usa los archivos de `public/brand/` según `docs/brand/README.md` (no los modifiques). Crea un componente `hk-logo` con entradas `variante: 'completo' | 'simbolo'` que elija automáticamente la versión clara u oscura según el tema y el fondo (el sidebar es oscuro en ambos temas → siempre `*-on-dark`).

### 2. Tema
- `ThemeService` (signals) con `system | light | dark` como en §1.5, script inline anti-parpadeo en `index.html`, `meta theme-color` actualizado según el tema.

### 3. Internacionalización
- Transloco con `es` (por defecto) y `en`, carga por scope de feature, `LanguageService` que sincroniza `<html lang>`, locale de Angular para fechas/números (`es-CO`, `en-US`) y persistencia en `localStorage`.
- Pipe/servicio de formato de moneda COP y fechas relativas ("hace 5 min").
- Un script (`npm run i18n:check`) que falle si `es` y `en` no tienen exactamente las mismas claves. Agrégalo al CI.

### 4. Kit de componentes (`shared/ui`)
Implementa los componentes de `DESIGN-SYSTEM.md` §6 **excepto** `hk-chart` y `hk-command-palette` (llegan en F11). Requisitos para cada uno:
- Standalone, `OnPush`, API con `input()`, `output()`, `model()`.
- Accesible por teclado y con roles/atributos ARIA correctos; overlays con Angular CDK.
- Estados: hover, focus-visible, disabled, loading y error donde aplique.
- Se ve impecable en claro y oscuro.
- `hk-table` debe cambiar a vista de tarjetas en móvil y soportar skeleton, vacío, orden y paginación.

Crea una ruta interna **`/dev/ui`** (solo en modo desarrollo, excluida del build de producción) con una galería de todos los componentes y variantes, con selector de tema e idioma. Es la vitrina para revisar el diseño.

### 5. Layout (`core/layout`)
- `ShellComponent` con sidebar, topbar y área de contenido, comportamiento responsive de §5 (sidebar colapsable con estado recordado, drawer en móvil y barra inferior en móvil).
- El menú se genera desde una configuración que declara ícono, clave i18n, ruta y permiso requerido (en esta fase todos visibles; el filtrado por permiso llega en F04B).
- Topbar con: breadcrumb automático desde la data de las rutas, campo de búsqueda (abre un placeholder por ahora), selector de idioma, toggle de tema (Sistema/Claro/Oscuro), campana (sin datos aún) y menú de usuario (sin datos aún).
- Páginas placeholder elegantes (`hk-empty-state` con "Próximamente") para cada módulo del menú, con rutas lazy ya definidas.
- Página 404 con estilo de marca.

### 6. Pulido visual
- Transiciones y animaciones según §4, respetando `prefers-reduced-motion`.
- Scrollbars discretas acordes al tema, selección de texto con color de marca, foco visible consistente.
- Revisa todo en 375, 768, 1024 y 1440 px. No puede haber scroll horizontal en ninguna.

### Pruebas obligatorias
- Unitarias: `ThemeService` (cambio de modo, persistencia, reacción a `matchMedia`), `LanguageService`, formateador COP, y para cada componente del kit: render, variantes principales, interacción por teclado y emisión de eventos.
- E2E: abrir `/dev/ui`, alternar tema e idioma y verificar que se aplican y persisten tras recargar; navegación por el sidebar en escritorio y en móvil (viewport 375).
- Accesibilidad: axe sobre `/dev/ui` en claro y oscuro sin violaciones serias o críticas.

### Criterios de aceptación
- [ ] Mándame capturas (Playwright) del shell y de `/dev/ui` en claro y oscuro, escritorio y móvil.
- [ ] Ningún color crudo de Tailwind en los componentes (`grep` por `-blue-`, `-gray-`, `-slate-` en `src/app` debe dar 0).
- [ ] `i18n:check`, lint, pruebas y build en verde. `PROGRESS.md` actualizado. PR, CI verde, merge.
