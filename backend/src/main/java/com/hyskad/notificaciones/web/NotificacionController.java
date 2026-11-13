package com.hyskad.notificaciones.web;

import java.util.Map;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.hyskad.notificaciones.application.NotificacionService;
import com.hyskad.notificaciones.application.StreamNotificaciones;
import com.hyskad.notificaciones.domain.Notificacion;
import com.hyskad.notificaciones.web.dto.NotificacionResponse;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.shared.web.PageResponse;

/**
 * Notificaciones del usuario actual (RF30) y su stream en tiempo real (IC5). Todo usuario
 * autenticado tiene las suyas; no hace falta un permiso adicional.
 */
@RestController
@RequestMapping("/api/v1/notificaciones")
public class NotificacionController {

    private final NotificacionService service;
    private final StreamNotificaciones stream;
    private final UsuarioActual usuarioActual;

    public NotificacionController(NotificacionService service, StreamNotificaciones stream,
            UsuarioActual usuarioActual) {
        this.service = service;
        this.stream = stream;
        this.usuarioActual = usuarioActual;
    }

    @GetMapping
    public PageResponse<NotificacionResponse> listar(@RequestParam(defaultValue = "false") boolean soloNoLeidas,
            @PageableDefault(size = 20, sort = { "fecha", "id" }, direction = Sort.Direction.DESC) Pageable pagina) {
        return PageResponse.of(service.mias(soloNoLeidas, pagina), NotificacionController::respuesta);
    }

    @GetMapping("/conteo-no-leidas")
    public Map<String, Long> conteoNoLeidas() {
        return Map.of("noLeidas", service.conteoNoLeidas());
    }

    @PatchMapping("/{id}/leida")
    public NotificacionResponse marcarLeida(@PathVariable Long id) {
        return respuesta(service.marcarLeida(id));
    }

    @PatchMapping("/leidas")
    public Map<String, Integer> marcarTodasLeidas() {
        return Map.of("marcadas", service.marcarTodasLeidas());
    }

    /** Ticket de un solo uso (30 s) para abrir el stream: {@code EventSource} no envía el JWT. */
    @PostMapping("/stream-ticket")
    public Map<String, String> ticket() {
        return Map.of("ticket", stream.emitirTicket(usuarioActual.idRequerido()));
    }

    /** Ruta pública en la cadena de seguridad: se autentica con el ticket. Sin ticket válido, 401. */
    @GetMapping("/stream")
    public ResponseEntity<SseEmitter> abrir(@RequestParam(required = false) String ticket) {
        return stream.canjear(ticket).map(usuarioId -> ResponseEntity.ok(stream.abrir(usuarioId)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    private static NotificacionResponse respuesta(Notificacion n) {
        return new NotificacionResponse(n.getId(), n.getTipo(), n.getTituloClave(), n.getMensajeClave(),
                n.getParametros() == null ? Map.of() : n.getParametros(), n.getEnlace(), n.isLeida(), n.getFecha());
    }
}
