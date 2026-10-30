// Verifica que los pares texto/fondo del sistema de diseño cumplen WCAG 2.1 AA en claro y oscuro.
// Lee los tokens directamente de src/styles.css para que no haya una segunda fuente de verdad.
// Uso: npm run contrast:check
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(raiz, 'src/styles.css'), 'utf8');

function leerBloque(selector) {
  const inicio = css.search(new RegExp(`^${selector.replace('.', '\\.')} \\{`, 'm'));
  if (inicio < 0) throw new Error(`No se encontró el bloque ${selector} en styles.css`);
  const fin = css.indexOf('}', inicio);
  const tokens = {};
  for (const [, nombre, valor] of css
    .slice(inicio, fin)
    .matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    tokens[nombre] = valor.toLowerCase();
  }
  return tokens;
}

function leerEscala() {
  const tokens = {};
  for (const [, nombre, valor] of css.matchAll(
    /--color-((?:brand|navy)-\d+|accent):\s*(#[0-9a-fA-F]{6})/g,
  )) {
    tokens[nombre] = valor.toLowerCase();
  }
  return tokens;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const aHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Color `hex` con opacidad `alfa` sobre el fondo `fondo` (así se ven los tokens -soft). */
const mezclar = (hex, alfa, fondo) =>
  aHex(rgb(hex).map((v, i) => v * alfa + rgb(fondo)[i] * (1 - alfa)));

function luminancia(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const TEXTO = 4.5;
const NO_TEXTO = 3;

function pares(t) {
  const soft = (color) => mezclar(t[color], 0.12, t.surface);
  return [
    ['fg / bg', t.fg, t.bg, TEXTO],
    ['fg / surface', t.fg, t.surface, TEXTO],
    ['fg / surface-2', t.fg, t['surface-2'], TEXTO],
    ['muted / bg', t.muted, t.bg, TEXTO],
    ['muted / surface', t.muted, t.surface, TEXTO],
    ['muted / surface-2', t.muted, t['surface-2'], TEXTO],
    ['primary-fg / primary', t['primary-fg'], t.primary, TEXTO],
    ['primary-fg / primary-hover', t['primary-fg'], t['primary-hover'], TEXTO],
    ['primary / surface (enlaces)', t.primary, t.surface, TEXTO],
    ['primary / bg (enlaces)', t.primary, t.bg, TEXTO],
    ['danger / surface (errores)', t.danger, t.surface, TEXTO],
    ['sidebar-fg / sidebar-bg', t['sidebar-fg'], t['sidebar-bg'], TEXTO],
    ['sidebar-fg / sidebar-bg-2', t['sidebar-fg'], t['sidebar-bg-2'], TEXTO],
    ['success-ink / success-soft', t['success-ink'], soft('success'), TEXTO],
    ['warning-ink / warning-soft', t['warning-ink'], soft('warning'), TEXTO],
    ['danger-ink / danger-soft', t['danger-ink'], soft('danger'), TEXTO],
    ['info-ink / info-soft', t['info-ink'], soft('info'), TEXTO],
    ['accent-ink / accent-soft', t['accent-ink'], soft('accent-tone'), TEXTO],
    ['primary-ink / primary-soft', t['primary-ink'], soft('primary'), TEXTO],
    ['neutral-ink / surface-2', t['neutral-ink'], t['surface-2'], TEXTO],
    ['border-strong / surface (bordes de controles)', t['border-strong'], t.surface, NO_TEXTO],
    ['border-strong / bg (bordes de controles)', t['border-strong'], t.bg, NO_TEXTO],
    ['ring / bg (foco)', t.ring, t.bg, NO_TEXTO],
    ['ring / surface (foco)', t.ring, t.surface, NO_TEXTO],
    ['danger / surface (borde de error)', t.danger, t.surface, NO_TEXTO],
  ];
}

const escala = leerEscala();
// Fondos de hk-avatar: siempre con texto brand-50 o brand-950 según el fondo.
const paresAvatar = [
  ['avatar brand-50 / brand-600', escala['brand-50'], escala['brand-600'], TEXTO],
  ['avatar brand-50 / brand-800', escala['brand-50'], escala['brand-800'], TEXTO],
  ['avatar brand-50 / brand-950', escala['brand-50'], escala['brand-950'], TEXTO],
  ['avatar brand-950 / accent', escala['brand-950'], escala['accent'], TEXTO],
  ['avatar brand-950 / brand-200', escala['brand-950'], escala['brand-200'], TEXTO],
  ['avatar brand-950 / brand-400', escala['brand-950'], escala['brand-400'], TEXTO],
];

let fallos = 0;
for (const [tema, tokens] of [
  ['claro', leerBloque(':root')],
  ['oscuro', leerBloque('.dark')],
]) {
  console.log(`\nTema ${tema}`);
  for (const [nombre, a, b, minimo] of pares(tokens)) {
    if (!a || !b) throw new Error(`Falta un token en el par "${nombre}" (${tema})`);
    const valor = contraste(a, b);
    const ok = valor >= minimo;
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✘'} ${nombre.padEnd(48)} ${valor.toFixed(2)} (mín. ${minimo})`);
  }
}
console.log('\nAvatares');
for (const [nombre, a, b, minimo] of paresAvatar) {
  const valor = contraste(a, b);
  if (valor < minimo) fallos++;
  console.log(
    `  ${valor >= minimo ? '✔' : '✘'} ${nombre.padEnd(48)} ${valor.toFixed(2)} (mín. ${minimo})`,
  );
}

if (fallos > 0) {
  console.error(`\n${fallos} par(es) no cumplen el contraste AA.`);
  process.exit(1);
}
console.log('\nTodos los pares cumplen el contraste AA.');
