package com.hyskad.auditoria.web;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.auditoria.web.dto.AuditoriaResponse;
import com.hyskad.shared.audit.Auditoria;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.shared.web.PageResponse;
import com.hyskad.usuarios.application.UsuarioService;

/** Consulta de auditoría (RF31) con {@code AUDITORIA_VER}: la más reciente primero. */
@RestController
@RequestMapping("/api/v1/auditoria")
@PreAuthorize("hasAuthority('AUDITORIA_VER')")
public class AuditoriaController {

    private final AuditoriaService service;
    private final UsuarioService usuarios;

    public AuditoriaController(AuditoriaService service, UsuarioService usuarios) {
        this.service = service;
        this.usuarios = usuarios;
    }

    /** Filtros opcionales; las fechas son días de Bogotá (RN-53) con {@code hasta} inclusivo. */
    @GetMapping
    public PageResponse<AuditoriaResponse> buscar(@RequestParam(required = false) Long usuarioId,
            @RequestParam(required = false) String entidad, @RequestParam(required = false) String accion,
            @RequestParam(required = false) LocalDate desde, @RequestParam(required = false) LocalDate hasta,
            @PageableDefault(size = 20, sort = { "fecha", "id" }, direction = Sort.Direction.DESC) Pageable pagina) {
        return pagina(service.buscar(usuarioId, entidad, null, accion, inicio(desde),
                hasta == null ? null : inicio(hasta.plusDays(1)), pagina));
    }

    /** Historia de un registro (p. ej. una orden, una venta o un usuario). */
    @GetMapping("/entidad/{entidad}/{id}")
    public PageResponse<AuditoriaResponse> deEntidad(@PathVariable String entidad, @PathVariable Long id,
            @PageableDefault(size = 50, sort = { "fecha", "id" }, direction = Sort.Direction.DESC) Pageable pagina) {
        return pagina(service.buscar(null, entidad, id, null, null, null, pagina));
    }

    private PageResponse<AuditoriaResponse> pagina(Page<Auditoria> registros) {
        Map<Long, String> nombres = usuarios.nombres(registros.stream().map(Auditoria::getUsuarioId)
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        return PageResponse.of(registros, a -> new AuditoriaResponse(a.getId(), a.getFecha(),
                a.getUsuarioId() == null ? null : new AuditoriaResponse.Usuario(a.getUsuarioId(),
                        nombres.get(a.getUsuarioId())),
                a.getAccion(), a.getEntidad(), a.getEntidadId(), a.getDetalle(), a.getIp()));
    }

    private static Instant inicio(LocalDate dia) {
        return dia == null ? null : dia.atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant();
    }
}
