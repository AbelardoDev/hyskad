package com.hyskad.shared.web;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Asigna un identificador a cada petición (o reutiliza el de {@code X-Request-Id} si es seguro),
 * lo deja en el MDC para los logs y lo devuelve en la respuesta.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String CABECERA = "X-Request-Id";
    public static final String MDC_CLAVE = "requestId";
    private static final Pattern ID_SEGURO = Pattern.compile("^[A-Za-z0-9._-]{1,64}$");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String recibido = request.getHeader(CABECERA);
        String requestId = recibido != null && ID_SEGURO.matcher(recibido).matches()
                ? recibido
                : UUID.randomUUID().toString();
        MDC.put(MDC_CLAVE, requestId);
        response.setHeader(CABECERA, requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_CLAVE);
        }
    }
}
