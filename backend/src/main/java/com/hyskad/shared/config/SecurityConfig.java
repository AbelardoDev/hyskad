package com.hyskad.shared.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * API sin estado autenticada con el JWT del propio backend (OAuth2 Resource Server). CSRF va
 * deshabilitado: el access token viaja en la cabecera {@code Authorization} y la cookie de refresh
 * es {@code SameSite=Strict} y solo aplica a {@code /api/v1/auth}. Los errores 401/403 de la cadena
 * de filtros se delegan al {@code GlobalExceptionHandler} para que salgan como ProblemDetail. Las
 * cabeceras de seguridad por defecto de Spring Security quedan activas.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private static final String[] RUTAS_PUBLICAS = {
        "/actuator/health", "/api/docs", "/api/docs/**", "/api/swagger-ui/**", "/error"
    };

    private static final String[] AUTH_PUBLICAS = {
        "/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout",
        "/api/v1/auth/password/olvide", "/api/v1/auth/password/restablecer"
    };

    /** Solo con el perfil {@code e2e}: el controller de reinicio no existe en los demás. */
    private static final String RESET_E2E = "/api/v1/test/reset";

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver,
            JwtAuthenticationConverter jwtAuthenticationConverter, Environment entorno) throws Exception {
        boolean e2e = entorno.matchesProfiles("e2e");
        AuthenticationEntryPoint noAutenticado = (req, res, ex) -> resolver.resolveException(req, res, null, ex);
        AccessDeniedHandler accesoDenegado = (req, res, ex) -> resolver.resolveException(req, res, null, ex);
        return http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(RUTAS_PUBLICAS).permitAll()
                            .requestMatchers(HttpMethod.POST, AUTH_PUBLICAS).permitAll();
                    if (e2e) {
                        auth.requestMatchers(HttpMethod.POST, RESET_E2E).permitAll();
                    }
                    auth.anyRequest().authenticated();
                })
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter))
                        .authenticationEntryPoint(noAutenticado)
                        .accessDeniedHandler(accesoDenegado))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(noAutenticado)
                        .accessDeniedHandler(accesoDenegado))
                .build();
    }
}
