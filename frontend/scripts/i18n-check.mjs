// Falla si es.json y en.json no tienen exactamente las mismas claves, en la raíz y en cada scope.
// Uso: npm run i18n:check
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const carpetaI18n = resolve(raiz, 'public/i18n');
const IDIOMAS = ['es', 'en'];

function aplanar(objeto, prefijo = '') {
  return Object.entries(objeto).flatMap(([clave, valor]) => {
    const ruta = prefijo ? `${prefijo}.${clave}` : clave;
    if (valor !== null && typeof valor === 'object') return aplanar(valor, ruta);
    if (typeof valor !== 'string' || valor.trim() === '')
      return [`${ruta} (valor vacío o no es texto)`];
    return [ruta];
  });
}

function carpetas(dir) {
  const hijas = readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory());
  return [dir, ...hijas.flatMap((n) => carpetas(join(dir, n)))];
}

let errores = 0;
for (const dir of carpetas(carpetaI18n)) {
  const nombre = relative(carpetaI18n, dir) || '(raíz)';
  const archivos = IDIOMAS.map((idioma) => join(dir, `${idioma}.json`));
  if (!archivos.some(existsSync)) continue;

  const claves = {};
  for (const [i, archivo] of archivos.entries()) {
    if (!existsSync(archivo)) {
      console.error(`✘ ${nombre}: falta ${IDIOMAS[i]}.json`);
      errores++;
      continue;
    }
    try {
      claves[IDIOMAS[i]] = new Set(aplanar(JSON.parse(readFileSync(archivo, 'utf8'))));
    } catch (e) {
      console.error(`✘ ${nombre}/${IDIOMAS[i]}.json no es JSON válido: ${e.message}`);
      errores++;
    }
  }
  if (Object.keys(claves).length !== IDIOMAS.length) continue;

  for (const [origen, destino] of [IDIOMAS, [...IDIOMAS].reverse()]) {
    for (const clave of claves[origen]) {
      if (!claves[destino].has(clave)) {
        console.error(`✘ ${nombre}: "${clave}" está en ${origen}.json pero no en ${destino}.json`);
        errores++;
      }
    }
  }
  if (errores === 0) console.log(`✔ ${nombre}: ${claves.es.size} claves`);
}

if (errores > 0) {
  console.error(`\n${errores} diferencia(s) entre idiomas.`);
  process.exit(1);
}
console.log('\nes y en tienen las mismas claves.');
