import { FormControl } from '@angular/forms';

import {
  digitoVerificacionNit,
  documentoParaMostrar,
  documentoSegunTipo,
  documentoValido,
  fortalezaPassword,
  igualA,
  normalizarPlaca,
  normalizarTelefono,
  passwordSegura,
  PATRON_TELEFONO,
  placaColombiana,
  reglasPassword,
  telefonoColombiano,
  TipoDocumento,
  vinValido,
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

describe('documentos (espejo de @DocumentoValido, RN-38 y RN-39)', () => {
  it.each([
    ['900123456', 8],
    ['860001022', 7],
    ['901458732', 8],
    ['800197268', 4],
  ])('DV del NIT %s es %i', (nit, dv) => {
    expect(digitoVerificacionNit(nit)).toBe(dv);
  });

  it('el DV no se calcula para algo que no son dígitos', () => {
    expect(digitoVerificacionNit('90012A456')).toBeNull();
    expect(digitoVerificacionNit('')).toBeNull();
  });

  it.each<[TipoDocumento, string, boolean]>([
    ['CC', '1067845123', true],
    ['CC', '1.067.845.123', true],
    ['CC', '1234', false],
    ['CC', '12345678901', false],
    ['TI', '1067998877', true],
    ['TI', '123456789', false],
    ['CE', 'e4589123', true],
    ['CE', 'E4', false],
    ['PA', 'AB1234567', true],
    ['PA', 'AB-12', false],
    ['PPT', '4567890', true],
    ['PPT', '45678', false],
    ['NIT', '900123456-8', true],
    ['NIT', '900.123.456-8', true],
    ['NIT', '900123456-7', false],
    ['NIT', '900123456', false],
  ])('%s %s → %s', (tipo, numero, valido) => {
    expect(documentoValido(tipo, numero)).toBe(valido);
  });

  it('el validador sigue el tipo elegido y usa los códigos del backend', () => {
    let tipo: TipoDocumento = 'NIT';
    const validador = documentoSegunTipo(() => tipo);
    expect(validador(new FormControl('900123456-7'))).toEqual({ nitInvalido: true });
    expect(validador(new FormControl('900123456-8'))).toBeNull();
    tipo = 'CC';
    expect(validador(new FormControl('AB-1234'))).toEqual({ documentoInvalido: true });
    expect(validador(new FormControl(''))).toBeNull();
  });

  it('muestra el NIT con guion antes del DV', () => {
    expect(documentoParaMostrar('NIT', '900.123.4568')).toBe('900123456-8');
    expect(documentoParaMostrar('CC', '1.067.845.123')).toBe('1067845123');
  });
});

describe('placas (CP-17, espejo de PlacaColombianaValidator, RN-41)', () => {
  it.each(['ABC12D', 'abc-12d', 'ABC12', '123ABC', ' abc 12 d ', '123-abc'])(
    '%s es válida',
    (placa) => {
      expect(placaColombiana(new FormControl(placa))).toBeNull();
    },
  );

  it.each(['AB123', 'ABCD12', 'ABC123', '12ABC', 'ABC1D', 'ÑBC12D', 'ABC12DE'])(
    '%s es inválida',
    (placa) => {
      expect(placaColombiana(new FormControl(placa))).toEqual({ placaInvalida: true });
    },
  );

  it('vacía la deja a required y normaliza a mayúsculas sin espacios ni guiones', () => {
    expect(placaColombiana(new FormControl(''))).toBeNull();
    expect(normalizarPlaca('abc-12 d')).toBe('ABC12D');
  });
});

describe('teléfono colombiano y VIN', () => {
  it.each([
    ['3001234567', null],
    ['+57 300 123-4567', null],
    ['(604) 789.1234', null],
    ['', null],
    ['300123456', { telefonoInvalido: true }],
    ['2001234567', { telefonoInvalido: true }],
    ['6101234567', { telefonoInvalido: true }],
  ])('teléfono %s → %j', (valor, esperado) => {
    expect(telefonoColombiano(new FormControl(valor))).toEqual(esperado);
    expect(normalizarTelefono('+57 300 123-4567')).toBe('3001234567');
  });

  it.each([
    ['9C6KE1220M0012345', null],
    ['9c6ke1220m0012345', null],
    ['', null],
    ['9C6KE1220M001234', { vinInvalido: true }],
    ['9C6KE1220O0012345', { vinInvalido: true }],
    ['IC6KE1220M0012345', { vinInvalido: true }],
  ])('VIN %s → %j', (valor, esperado) => {
    expect(vinValido(new FormControl(valor))).toEqual(esperado);
  });
});
