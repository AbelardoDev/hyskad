# Marca HYSKAD

Símbolo: engranaje + llave de boca/estrella, con el "perno" cian como punto de acento. Rediseño en vectores del logo original (se simplificó la mano para que el símbolo se lea bien en tamaños pequeños).

| Archivo | Uso |
|---|---|
| `logo.svg` | Logotipo horizontal (símbolo + HYSKAD) sobre fondos claros |
| `logo-on-dark.svg` | Logotipo horizontal sobre fondos oscuros (sidebar, login, modo oscuro) |
| `logo-mark.svg` | Solo el símbolo, fondos claros |
| `logo-mark-on-dark.svg` | Solo el símbolo, fondos oscuros (sidebar colapsado) |
| `logo-mark-mono.svg` | Símbolo de un color que hereda `currentColor` (sellos, impresión en B/N) |
| `app-icon.svg` / `icon-192.png` / `icon-512.png` | Ícono de app con fondo navy redondeado |
| `app-icon-maskable.svg` / `icon-maskable-512.png` | Ícono para Android con zona segura (PWA) |
| `favicon.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png` | Pestaña del navegador |
| `apple-touch-icon.png` | iPhone/iPad al agregar a inicio (180 px) |
| `logo-email.png` | Correos (Gmail/Outlook no muestran SVG) — 480 px de ancho, mostrar a 240 px |
| `logo-mark-1024.png` | Símbolo en alta resolución (documentos, presentaciones) |
| `site.webmanifest` | Manifiesto web con los íconos |

**Colores:** engranaje `#1A46B5 → #0F1D3F`, llave `#5698FF → #1D58E0`, perno `#38BDF8` (en oscuro: engranaje `#5698FF`, llave blanca). Tipografía del nombre: Plus Jakarta Sans ExtraBold, convertida a curvas (no depende de fuentes instaladas).

**Reglas:** espacio libre alrededor igual al diámetro del perno; tamaño mínimo del símbolo 20 px y del logotipo 96 px de ancho; no deformar, rotar ni cambiar colores fuera de estas variantes.

`_fuente/generar-logo.py` regenera todo (requiere `shapely`, `fonttools`, `brotli`, `cairosvg`, `Pillow` y el `.woff2` de Plus Jakarta Sans 800).
