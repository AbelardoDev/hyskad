// Calcula el hash SHA-256 de cada <script> en línea del index.html compilado y escribe la variable
// de Nginx que usa la Content-Security-Policy (F13). Se corre al construir la imagen, así los
// hashes siempre coinciden con el build: el script anti-parpadeo del tema y el que agrega Beasties
// para cargar el CSS crítico.
//   node scripts/csp-hashes.mjs dist/frontend/browser/index.html > csp-hashes.conf
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: node scripts/csp-hashes.mjs <index.html>');
  process.exit(1);
}

const html = readFileSync(archivo, 'utf8');
const enLinea = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
const hashes = [...html.matchAll(enLinea)].map(
  ([, codigo]) => `'sha256-${createHash('sha256').update(codigo, 'utf8').digest('base64')}'`,
);

if (hashes.length === 0) {
  console.error(`No se encontraron scripts en línea en ${archivo}`);
  process.exit(1);
}

process.stdout.write(
  `# Generado por scripts/csp-hashes.mjs; no editar\nset $csp_script_hashes "${hashes.join(' ')}";\n`,
);
