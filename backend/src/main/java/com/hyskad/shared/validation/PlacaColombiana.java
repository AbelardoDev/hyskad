package com.hyskad.shared.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

/** Placa colombiana de moto o motocarro (RN-41). {@code null} es válido: combinar con {@code @NotBlank}. */
@Documented
@Constraint(validatedBy = PlacaColombianaValidator.class)
@Target({ ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface PlacaColombiana {

    String message() default "PLACA_INVALIDA";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
