package com.hyskad.ping;

import java.time.Instant;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint temporal para probar la conexión de punta a punta (Angular → proxy → Spring Boot).
 * Se elimina en F02.
 */
@RestController
@RequestMapping("/api/v1/ping")
public class PingController {

    @GetMapping
    public PingResponse ping() {
        return new PingResponse("pong", Instant.now());
    }

    public record PingResponse(String mensaje, Instant fecha) {
    }
}
