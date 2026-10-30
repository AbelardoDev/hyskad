package com.hyskad.shared.config;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Reloj único de la aplicación (UTC, RN-53) y JPA Auditing. Las pruebas pueden reemplazar el
 * bean {@link Clock} para fijar el tiempo.
 */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorActual", dateTimeProviderRef = "proveedorFechaAuditoria")
public class TiempoConfig {

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    DateTimeProvider proveedorFechaAuditoria(Clock clock) {
        return () -> Optional.of(Instant.now(clock));
    }

    /** Usuario autenticado para created_by/updated_by. Vacío hasta que llegue la autenticación (F03). */
    @Bean
    AuditorAware<Long> auditorActual() {
        return Optional::empty;
    }
}
