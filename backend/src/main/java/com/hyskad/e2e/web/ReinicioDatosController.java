package com.hyskad.e2e.web;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.e2e.application.ReinicioDatosService;

/** Apoyo de las pruebas E2E. Solo existe con el perfil {@code e2e}; en los demás la ruta da 404. */
@RestController
@RequestMapping("/api/v1/test")
@Profile("e2e")
public class ReinicioDatosController {

    public static final String RUTA_RESET = "/api/v1/test/reset";

    private final ReinicioDatosService service;

    public ReinicioDatosController(ReinicioDatosService service) {
        this.service = service;
    }

    @PostMapping("/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reiniciar() {
        service.reiniciar();
    }
}
