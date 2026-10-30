package com.hyskad.auth.application;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Sesión y recuperación de contraseña: vigencia del refresh token (7 días), si la cookie lleva
 * {@code Secure} (solo se desactiva en dev, sin HTTPS) y vigencia del enlace de recuperación (30 min).
 */
@ConfigurationProperties("hyskad.auth")
public record AuthProperties(Duration refreshVigencia, boolean cookieSecure, Duration recuperacionVigencia) {
}
