package com.hyskad.auth.web;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import com.hyskad.auth.application.AuthProperties;

/**
 * Cookie {@code hk_refresh}: {@code HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth}, para que
 * el refresh token no lo lea JavaScript ni viaje fuera de los endpoints de autenticación.
 */
@Component
public class CookieRefresh {

    public static final String NOMBRE = "hk_refresh";
    static final String RUTA = "/api/v1/auth";

    private final AuthProperties propiedades;

    public CookieRefresh(AuthProperties propiedades) {
        this.propiedades = propiedades;
    }

    public ResponseCookie con(String valor) {
        return base(valor).maxAge(propiedades.refreshVigencia()).build();
    }

    public ResponseCookie borrada() {
        return base("").maxAge(0).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String valor) {
        return ResponseCookie.from(NOMBRE, valor)
                .httpOnly(true)
                .secure(propiedades.cookieSecure())
                .sameSite("Strict")
                .path(RUTA);
    }
}
