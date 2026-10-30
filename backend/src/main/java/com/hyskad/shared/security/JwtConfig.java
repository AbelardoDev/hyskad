package com.hyskad.shared.security;

import java.util.Base64;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

import com.nimbusds.jose.jwk.source.ImmutableSecret;

/**
 * JWT firmados por el propio backend con HS256 (Nimbus, incluido en Spring Security) y BCrypt
 * cost 12 para las contraseñas. El claim {@code permisos} se convierte en authorities sin prefijo.
 */
@Configuration
public class JwtConfig {

    public static final String CLAIM_PERMISOS = "permisos";
    private static final int BYTES_MINIMOS_CLAVE = 32;
    private static final int COSTO_BCRYPT = 12;

    private final JwtProperties propiedades;

    public JwtConfig(JwtProperties propiedades) {
        this.propiedades = propiedades;
    }

    @Bean
    SecretKey claveJwt() {
        if (propiedades.secret() == null || propiedades.secret().isBlank()) {
            throw new IllegalStateException("Falta JWT_SECRET (clave base64 de al menos 256 bits)");
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(propiedades.secret().trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("JWT_SECRET no es base64 válido", e);
        }
        if (bytes.length < BYTES_MINIMOS_CLAVE) {
            throw new IllegalStateException("JWT_SECRET debe tener al menos 256 bits");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey claveJwt) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(claveJwt));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey claveJwt) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(claveJwt).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(propiedades.issuer()));
        return decoder;
    }

    @Bean
    JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter permisos = new JwtGrantedAuthoritiesConverter();
        permisos.setAuthoritiesClaimName(CLAIM_PERMISOS);
        permisos.setAuthorityPrefix("");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(permisos);
        return converter;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(COSTO_BCRYPT);
    }
}
