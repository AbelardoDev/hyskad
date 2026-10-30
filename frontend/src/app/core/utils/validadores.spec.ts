import { FormControl } from '@angular/forms';

import {
  fortalezaPassword,
  igualA,
  passwordSegura,
  PATRON_TELEFONO,
  reglasPassword,
} from './validadores';

describe('política de contraseñas (espejo de @PasswordSegura)', () => {
  it.each([
    ['Clave123', null],
    ['ñandú2026', null],
    ['', null],
    ['Corta1', { passwordDebil: true }],
    ['soloLetrasAqui', { passwordDebil: true }],
    ['1234567890', { passwordDebil: true }],
    ['a1' + 'é'.repeat(36), { passwordDebil: true }],
  ])('%s → %j', (valor, esperado) => {
    expect(passwordSegura(new FormControl(valor))).toEqual(esperado);
  });

  it('reglas y fortaleza para el medidor', () => {
    expect(reglasPassword('abc')).toEqual({
      longitud: false,
      letras: true,
      numeros: false,
      tamano: true,
    });
    expect(fortalezaPassword('')).toBe(0);
    expect(fortalezaPassword('abc')).toBe(1);
    expect(fortalezaPassword('clave1234')).toBe(2);
    expect(fortalezaPassword('Clave-Segura-2026')).toBe(3);
  });
});

describe('igualA', () => {
  it('marca noCoincide cuando difiere del otro control', () => {
    const nueva = new FormControl('Clave123');
    const confirmar = new FormControl(
      'Clave124',
      igualA(() => nueva),
    );
    expect(confirmar.errors).toEqual({ noCoincide: true });
    confirmar.setValue('Clave123');
    expect(confirmar.errors).toBeNull();
  });
});

describe('teléfono (espejo de DatosUsuario.TELEFONO)', () => {
  it.each([
    ['3001234567', true],
    ['+57 300 123 4567', true],
    ['12345', false],
    ['300-123-4567', false],
  ])('%s → %s', (valor, valido) => {
    expect(PATRON_TELEFONO.test(valor)).toBe(valido);
  });
});
