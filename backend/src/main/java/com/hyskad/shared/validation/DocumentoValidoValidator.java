package com.hyskad.shared.validation;

import java.util.Map;
import java.util.regex.Pattern;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** Formatos de documento (RN-38) y DV del NIT (RN-39). */
public class DocumentoValidoValidator implements ConstraintValidator<DocumentoValido, ConDocumento> {

    static final String NIT_INVALIDO = "NIT_INVALIDO";
    static final String DOCUMENTO_INVALIDO = "DOCUMENTO_INVALIDO";

    private static final Map<TipoDocumento, Pattern> FORMATOS = Map.of(
            TipoDocumento.CC, Pattern.compile("^\\d{5,10}$"),
            TipoDocumento.TI, Pattern.compile("^\\d{10,11}$"),
            TipoDocumento.CE, Pattern.compile("^[A-Z0-9]{3,12}$"),
            TipoDocumento.PA, Pattern.compile("^[A-Z0-9]{5,15}$"),
            TipoDocumento.PPT, Pattern.compile("^\\d{6,10}$"),
            TipoDocumento.NIT, Pattern.compile("^\\d{10}$")); // 9 dígitos + DV

    public static boolean esValido(TipoDocumento tipo, String numero) {
        String normalizado = Normalizador.documento(numero);
        if (tipo == null || normalizado == null || !FORMATOS.get(tipo).matcher(normalizado).matches()) {
            return false;
        }
        if (tipo == TipoDocumento.NIT) {
            int dv = Character.digit(normalizado.charAt(9), 10);
            return DigitoVerificacionNit.calcular(normalizado.substring(0, 9)) == dv;
        }
        return true;
    }

    @Override
    public boolean isValid(ConDocumento valor, ConstraintValidatorContext context) {
        if (valor == null || valor.tipoDocumento() == null || valor.numeroDocumento() == null) {
            return true;
        }
        if (esValido(valor.tipoDocumento(), valor.numeroDocumento())) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        context.buildConstraintViolationWithTemplate(
                valor.tipoDocumento() == TipoDocumento.NIT ? NIT_INVALIDO : DOCUMENTO_INVALIDO)
                .addPropertyNode("numeroDocumento")
                .addConstraintViolation();
        return false;
    }
}
