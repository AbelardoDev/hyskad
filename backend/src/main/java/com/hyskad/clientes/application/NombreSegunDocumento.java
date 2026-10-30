package com.hyskad.clientes.application;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import com.hyskad.shared.validation.TipoDocumento;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

/**
 * RN-39: con NIT es obligatoria la razón social; con los demás tipos, nombres y apellidos. Cada
 * campo que falte se reporta con {@code NOT_BLANK}, como un {@code @NotBlank} normal.
 */
@Documented
@Constraint(validatedBy = NombreSegunDocumento.Validador.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@interface NombreSegunDocumento {

    String message() default "NOT_BLANK";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validador implements ConstraintValidator<NombreSegunDocumento, GuardarCliente> {

        @Override
        public boolean isValid(GuardarCliente datos, ConstraintValidatorContext context) {
            if (datos == null || datos.tipoDocumento() == null) {
                return true;
            }
            context.disableDefaultConstraintViolation();
            if (datos.tipoDocumento() == TipoDocumento.NIT) {
                return requerido(datos.razonSocial(), "razonSocial", context);
            }
            boolean nombres = requerido(datos.nombres(), "nombres", context);
            boolean apellidos = requerido(datos.apellidos(), "apellidos", context);
            return nombres && apellidos;
        }

        private static boolean requerido(String valor, String campo, ConstraintValidatorContext context) {
            if (valor != null && !valor.isBlank()) {
                return true;
            }
            context.buildConstraintViolationWithTemplate("NOT_BLANK").addPropertyNode(campo).addConstraintViolation();
            return false;
        }
    }
}
