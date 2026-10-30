package com.hyskad.shared.validation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

/**
 * Contraseña que cumple la política del sistema: mínimo 8 caracteres, con letras y números.
 * {@code null} es válido: combinar con {@code @NotNull}.
 */
@Documented
@Constraint(validatedBy = PasswordSeguraValidator.class)
@Target({ ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface PasswordSegura {

    String message() default "PASSWORD_DEBIL";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
