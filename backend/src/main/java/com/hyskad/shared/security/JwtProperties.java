package com.hyskad.shared.security;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuración del access token: clave HS256 en base64 ({@code JWT_SECRET}, ≥ 256 bits), emisor
 * ({@code iss}) y vigencia.
 */
@ConfigurationProperties("hyskad.jwt")
public record JwtProperties(String secret, String issuer, Duration vigencia) {
}
