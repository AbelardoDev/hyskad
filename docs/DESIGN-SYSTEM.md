# Sistema de diseño de HYSKAD

**Personalidad:** moderna, limpia, confiable y técnica, como un buen dashboard SaaS, pero con carácter propio: azules profundos tipo "noche de taller" con acentos eléctricos. Cómoda para trabajar muchas horas: mucho aire, jerarquía clara, nada chillón.

**Regla de oro:** la interfaz se arma solo con los tokens y componentes de este documento. Si falta algo, se agrega aquí primero.

## 1. Color

### 1.1 Escala de marca (azules de oscuro a claro)

| Token | Hex | Uso típico |
|---|---|---|
| `brand-50` | `#EEF5FF` | Fondos de selección, hover suave (claro) |
| `brand-100` | `#D9E8FF` | Badges informativos (claro) |
| `brand-200` | `#BBD6FF` | Bordes de foco suaves |
| `brand-300` | `#8CBCFF` | Íconos secundarios (oscuro) |
| `brand-400` | `#5698FF` | Primario en modo oscuro |
| `brand-500` | `#2F74F5` | Acentos, gráficas |
| `brand-600` | `#1D58E0` | **Primario en modo claro** |
| `brand-700` | `#1A46B5` | Hover del primario (claro) |
| `brand-800` | `#1B3C8E` | Sidebar (claro), encabezados fuertes |
| `brand-900` | `#1B3570` | Degradados |
| `brand-950` | `#0F1D3F` | Texto principal (claro), degradados profundos |
| `navy-900` | `#121E36` | Superficie elevada (oscuro) |
| `navy-950` | `#0C1528` | Superficie (oscuro) |
| `navy-975` | `#070D1A` | Fondo de la app (oscuro) |
| `accent` | `#38BDF8` | Acento eléctrico (cian): indicadores en vivo, highlights, gráficas |

### 1.2 Tokens semánticos (lo que usan los componentes)

| Token | Claro | Oscuro |
|---|---|---|
| `bg` (fondo de la app) | `#F5F8FD` | `#070D1A` |
| `surface` (tarjetas, tablas) | `#FFFFFF` | `#0C1528` |
| `surface-2` (elevado, hover de fila, inputs) | `#F0F4FB` | `#121E36` |
| `border` | `#E2E8F3` | `#1C2B4A` |
| `fg` (texto principal) | `#0F1D3F` | `#E6EDF8` |
| `muted` (texto secundario) | `#5B6B8A` | `#8A9BBD` |
| `primary` | `#1D58E0` | `#5698FF` |
| `primary-hover` | `#1A46B5` | `#8CBCFF` |
| `primary-fg` (texto sobre primario) | `#FFFFFF` | `#06122B` |
| `ring` (foco) | `#2F74F5` | `#8CBCFF` |
| `border-strong` (borde de controles: inputs, checkbox) | `#7D8DB0` | `#5A6F98` |
| `sidebar-bg` | `#0F1D3F` → `#1B3570` (degradado vertical) | `#0A1222` |
| `sidebar-fg` | `#C9D7F2` | `#A9B8D6` |
| `success` | `#059669` | `#34D399` |
| `warning` | `#D97706` | `#FBBF24` |
| `danger` | `#DC2626` | `#F87171` |
| `info` | `#0284C7` | `#38BDF8` |

Cada color de estado (y `primary` y `accent`) tiene su variante `-soft` (fondo de badge/alerta al 12 % de opacidad) y su variante `-ink` (texto sobre ese fondo suave):

| Token `-ink` | Claro | Oscuro |
|---|---|---|
| `success-ink` | `#047857` | `#34D399` |
| `warning-ink` | `#A14F05` | `#FBBF24` |
| `danger-ink` | `#B91C1C` | `#F87171` |
| `info-ink` | `#0369A1` | `#38BDF8` |
| `accent-ink` | `#0E6A8A` | `#38BDF8` |
| `primary-ink` | `#1A46B5` | `#8CBCFF` |
| `neutral-ink` (badge neutro sobre `surface-2`) | `#4A5878` | `#A9B8D6` |

> Ajustes de F04A verificados con `npm run contrast:check` (lee `styles.css`): el `ring` claro pasó de `#5698FF` (2,7:1 sobre `bg`) a `#2F74F5` (4,0:1); los bordes de controles usan `border-strong` (≥ 3:1) porque `border` es decorativo; los colores de estado en claro no alcanzan 4,5:1 sobre su `-soft`, por eso existen los `-ink`.

El **sidebar es oscuro en ambos temas** (identidad de marca). En modo claro va con un degradado navy sutil.

### 1.3 Colores por estado de orden

| Estado | Color | Ícono (lucide) |
|---|---|---|
| RECIBIDA | `slate`/neutral | `inbox` |
| EN_DIAGNOSTICO | `info` | `stethoscope` |
| PENDIENTE_APROBACION | `warning` | `hourglass` |
| EN_REPARACION | `primary` | `wrench` |
| FINALIZADA | `accent` (cian) | `check-circle-2` |
| ENTREGADA | `success` | `package-check` |
| CANCELADA | `danger` | `x-circle` |

El badge siempre lleva **ícono + texto**, nunca solo color (accesibilidad).

### 1.4 Implementación en Tailwind v4

```css
/* frontend/src/styles.css */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-brand-50: #EEF5FF;  /* … resto de la escala … */
  --color-navy-975: #070D1A;
  --color-accent: #38BDF8;
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Plus Jakarta Sans Variable", "Inter Variable", sans-serif;
  --radius-card: 1rem;
}

:root { --bg: #F5F8FD; --surface: #FFFFFF; /* … */ color-scheme: light; }
.dark  { --bg: #070D1A; --surface: #0C1528; /* … */ color-scheme: dark; }

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-primary: var(--primary);
  /* … un --color-* por cada token semántico … */
}
```

Así existen utilidades como `bg-surface`, `text-muted`, `border-border`, `bg-primary text-primary-fg`. **No** se usan colores crudos de Tailwind en los componentes.

### 1.5 Tema claro/oscuro

- `ThemeService` con preferencia `system | light | dark` (por defecto `system`), guardada en `localStorage`.
- En `system` escucha `matchMedia('(prefers-color-scheme: dark)')` y reacciona en vivo.
- Aplica la clase `.dark` en `<html>`. Un script inline en `index.html` aplica la clase **antes** de que cargue Angular para evitar el parpadeo blanco.
- Toggle en la topbar: menú con tres opciones (Sistema / Claro / Oscuro) e íconos `monitor`, `sun`, `moon`. Transición suave de colores de 200 ms (desactivada con `prefers-reduced-motion`).

## 2. Tipografía

- **Inter Variable** para todo el texto de interfaz; **Plus Jakarta Sans Variable** para títulos de página, números grandes del dashboard y el login. Ambas auto-alojadas con `@fontsource-variable/*` (sin depender de Google Fonts).
- Números tabulares (`font-variant-numeric: tabular-nums`) en tablas, montos y KPIs.

| Rol | Tamaño / peso |
|---|---|
| Título de página | `text-2xl` / 700, `font-display`, `tracking-tight` |
| Título de sección / tarjeta | `text-base` / 600 |
| Cuerpo | `text-sm` / 400 (14 px) |
| Etiquetas y ayudas | `text-xs` / 500, color `muted` |
| KPI | `text-3xl` / 700, `font-display` |

## 3. Espaciado, forma y profundidad

- Escala de 4 px. Padding de tarjetas `p-5` (móvil `p-4`). Separación entre secciones `gap-6`.
- Radios: tarjetas y modales `rounded-2xl`, inputs y botones `rounded-xl`, badges `rounded-full`.
- Sombras suaves y con tinte azul en claro (`shadow-[0_1px_2px_rgb(15_29_63/0.06),0_8px_24px_-12px_rgb(15_29_63/0.12)]`); en oscuro, sin sombras: se usa borde `border` + leve brillo interior (`ring-1 ring-white/5`).
- Topbar con efecto vidrio: `bg-surface/80 backdrop-blur-md` y borde inferior.

## 4. Movimiento

- Duraciones: 150 ms (hover, foco), 200 ms (menús, toasts), 250 ms (modales, drawers). Curva `cubic-bezier(0.2, 0, 0, 1)`.
- Entradas: fade + desplazamiento de 4–8 px. Sin rebotes.
- Skeletons con shimmer sutil. Contadores del dashboard animan de 0 al valor en 600 ms.
- Todo se desactiva con `prefers-reduced-motion: reduce`.

## 5. Layout

- **Escritorio (≥ 1024 px):** sidebar fijo de 260 px, colapsable a 76 px (solo íconos con tooltip), estado recordado. Contenido con ancho máximo de 1440 px.
- **Tablet (768–1023 px):** sidebar colapsado por defecto.
- **Móvil (< 768 px):** sidebar como drawer (CDK overlay) y **barra de navegación inferior** con los 4 accesos principales según el rol.
- **Topbar:** botón de menú, breadcrumb, buscador global (abre la paleta de comandos con `Ctrl/⌘ + K`), selector de idioma (ES/EN), toggle de tema, campana de notificaciones con contador en vivo (punto cian pulsante cuando hay nuevas) y menú de usuario (perfil, cambiar contraseña, cerrar sesión).
- Encabezado de página estándar (`hk-page-header`): título, subtítulo, breadcrumb y acciones a la derecha (en móvil, acción principal como botón flotante).

## 6. Kit de componentes (`shared/ui`, prefijo `hk-`)

| Componente | Notas |
|---|---|
| `hk-button` | Variantes `primary`, `secondary`, `ghost`, `danger`, `link`; tamaños `sm/md/lg`; estado `loading` (spinner y deshabilitado); ícono opcional |
| `hk-icon-button` | Siempre con `aria-label` |
| `hk-input`, `hk-textarea`, `hk-select`, `hk-combobox` (búsqueda con autocompletado), `hk-checkbox`, `hk-switch`, `hk-date-input`, `hk-money-input` (formatea COP mientras se escribe) | Integrados con formularios reactivos (`ControlValueAccessor`). Etiqueta, ayuda y error debajo del campo |
| `hk-form-field` | Contenedor que muestra error traducido según el validador |
| `hk-card`, `hk-stat-card` (KPI con ícono, variación y sparkline opcional) | |
| `hk-table` | Encabezado fijo, orden por columna, selección opcional, paginación, filas clicables, skeleton. En móvil se transforma en **lista de tarjetas** |
| `hk-pagination`, `hk-filter-bar` (búsqueda + chips de filtros activos) | |
| `hk-badge`, `hk-status-badge` (estado de orden con ícono) | |
| `hk-modal`, `hk-drawer`, `hk-confirm-dialog` | Angular CDK Dialog; trampa de foco; `Esc` cierra; el diálogo de confirmación peligrosa pide escribir el motivo cuando aplica |
| `hk-toast` (servicio `ToastService`) | Arriba a la derecha (abajo en móvil), auto-cierre 4 s, `aria-live="polite"` |
| `hk-tabs`, `hk-stepper` (línea de tiempo del estado de la orden) | |
| `hk-empty-state` | Ícono grande en círculo degradado, título, texto y acción |
| `hk-skeleton` | |
| `hk-avatar` | Iniciales con color derivado del nombre (6 fondos de la escala de marca: `brand-600/800/950` con texto `brand-50`; `accent`, `brand-200/400` con texto `brand-950`) |
| `hk-dropdown-menu`, `hk-tooltip` | CDK Overlay |
| `hk-command-palette` | Búsqueda global de clientes, motos (por placa), órdenes, productos y acciones rápidas |
| `hk-chart` | Wrapper de Chart.js que lee los tokens de color y se re-renderiza al cambiar el tema |

Cada componente: `OnPush`, inputs con `input()`/`model()`, accesible por teclado, probado en claro y oscuro.

## 7. Pantallas clave (dirección visual)

- **Login:** pantalla dividida. Izquierda: panel con degradado `brand-950 → brand-800`, una malla de puntos o líneas tenues, el logo grande y una frase corta del producto. Derecha: formulario centrado en tarjeta, con mostrar/ocultar contraseña, "¿Olvidaste tu contraseña?", y toggles de tema e idioma arriba. En móvil, solo el formulario con el logo encima.
- **Dashboard:** fila de KPIs (ventas de hoy, órdenes activas, pendientes de aprobación, por cobrar, stock bajo), gráfica de ingresos de los últimos 30 días (área con degradado azul), distribución de órdenes por estado (dona), lista de últimas órdenes y lista de productos con stock bajo. El mecánico ve solo "Mis órdenes" en tarjetas grandes.
- **Tablero de órdenes:** vista de **lista** (tabla con filtros) y vista **kanban** por estado (columnas con contador), conmutables.
- **Detalle de orden:** encabezado con número, placa en estilo "placa" (fondo amarillo suave, tipografía monoespaciada, borde oscuro), cliente, estado y acciones permitidas según estado y permisos. Línea de tiempo del estado. Pestañas: Resumen · Diagnóstico · Servicios y repuestos · Presupuestos · Pago y entrega · Historial.
- **Vista del mecánico (móvil primero):** tarjetas de sus órdenes con placa, modelo y estado; dentro, botones grandes (mín. 44 px) para registrar diagnóstico, agregar repuesto (buscador con stock disponible visible) y cambiar estado.
- **Nueva venta (punto de venta):** buscador de productos a la izquierda (o arriba en móvil), carrito a la derecha con cantidades editables, totales en vivo (subtotal, descuento, IVA, total), método de pago y cálculo del cambio en efectivo.
- **Comprobantes:** vista imprimible (`@media print`) con logo, datos del taller, número, cliente, detalle, totales y la leyenda de RN-06. Botón "Imprimir / Guardar PDF".

## 8. Logo

- Archivos en `frontend/public/brand/` (catálogo y reglas de uso en `docs/brand/README.md`): `logo.svg` / `logo-on-dark.svg` (logotipo horizontal), `logo-mark.svg` / `logo-mark-on-dark.svg` (símbolo), `logo-mark-mono.svg` (`currentColor`), íconos de app, favicons, `logo-email.png` y `site.webmanifest`.
- Sidebar expandido: `logo-on-dark.svg`; colapsado: `logo-mark-on-dark.svg`. Login: `logo-on-dark.svg` sobre el panel navy. Comprobantes impresos: `logo.svg`. Correos: `logo-email.png`.
- Símbolo: engranaje (`#1A46B5 → #0F1D3F`), llave (`#5698FF → #1D58E0`) y perno cian `#38BDF8`, que es el mismo color `accent` de la interfaz.

## 9. Accesibilidad (WCAG 2.1 AA)

- Contraste mínimo 4.5:1 en texto normal y 3:1 en texto grande y bordes de controles, en ambos temas.
- Foco visible siempre: `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-bg`.
- Áreas táctiles de mínimo 44 × 44 px en móvil.
- `lang` del documento sincronizado con el idioma activo.
- Formularios: errores anunciados (`aria-describedby`, `aria-invalid`), el primer campo con error recibe el foco al enviar.
- Tablas con `<th scope>`; íconos decorativos con `aria-hidden="true"`.

## 10. Internacionalización

- Transloco con `es` (por defecto) y `en`. Archivos por feature (`i18n/taller/es.json`) para no tener un JSON gigante.
- Moneda siempre COP; fechas y números formateados con la locale activa (`es-CO` / `en-US`).
- Los mensajes de error del backend llegan como `code` y se traducen en `errors.<CODE>`.
- Selector de idioma en topbar y en login; preferencia guardada en `localStorage` y en el perfil del usuario.
