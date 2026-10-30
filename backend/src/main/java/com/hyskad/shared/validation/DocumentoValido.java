package com.hyskad.shared.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

/**
 * Valida el número de documento según su tipo (RN-38) y el DV del NIT (RN-39). Se pone en la
 * clase (que implementa {@link ConDocumento}) y reporta el error en el campo
 * {@code numeroDocumento} con el código {@code NIT_INVALIDO} o {@code DOCUMENTO_INVALIDO}.
 */
@Documented
@Constraint(validatedBy = DocumentoValidoValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface DocumentoValido {

    String message() default "DOCUMENTO_INVALIDO";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
