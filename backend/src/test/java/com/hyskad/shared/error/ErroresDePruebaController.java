package com.hyskad.shared.error;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.shared.validation.ConDocumento;
import com.hyskad.shared.validation.DocumentoValido;
import com.hyskad.shared.validation.PlacaColombiana;
import com.hyskad.shared.validation.TipoDocumento;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/** Controller solo de pruebas: provoca cada tipo de error que maneja el GlobalExceptionHandler. */
@RestController
@RequestMapping("/api/v1/pruebas-errores")
class ErroresDePruebaController {

    @DocumentoValido
    record SolicitudPrueba(@NotBlank String nombre, @PlacaColombiana String placa, TipoDocumento tipoDocumento,
            String numeroDocumento) implements ConDocumento {
    }

    @PostMapping
    SolicitudPrueba crear(@Valid @RequestBody SolicitudPrueba solicitud) {
        return solicitud;
    }

    @GetMapping("/parametro")
    int parametro(@RequestParam @Min(1) @Max(10) int cantidad) {
        return cantidad;
    }

    @GetMapping("/no-encontrado")
    void noEncontrado() {
        throw new NotFoundException("producto", 99);
    }

    @GetMapping("/acceso-denegado")
    @PreAuthorize("hasAuthority('PERMISO_QUE_NADIE_TIENE')")
    void accesoDenegado() {
        // Nunca se ejecuta: la seguridad de método lo impide.
    }

    @GetMapping("/concurrencia")
    void concurrencia() {
        throw new ObjectOptimisticLockingFailureException(Object.class, 1L);
    }

    @GetMapping("/integridad")
    void integridad() {
        throw new DataIntegrityViolationException("Duplicate entry 'secreto' for key 'uq_tabla_campo'");
    }

    @GetMapping("/inesperado")
    void inesperado() {
        throw new IllegalStateException("detalle interno que no debe salir");
    }
}
