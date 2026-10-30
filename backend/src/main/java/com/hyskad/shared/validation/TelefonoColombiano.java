package com.hyskad.shared.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

/**
 * Teléfono colombiano de 10 dígitos: celular ({@code 3xxxxxxxxx}) o fijo con indicativo
 * ({@code 60xxxxxxxx}). Se normaliza con {@link Normalizador#telefono} antes de comparar.
 * {@code null} es válido: combinar con {@code @NotBlank}.
 */
@Documented
@Constraint(validatedBy = TelefonoColombianoValidator.class)
@Target({ ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface TelefonoColombiano {

    String message() default "TELEFONO_INVALIDO";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
