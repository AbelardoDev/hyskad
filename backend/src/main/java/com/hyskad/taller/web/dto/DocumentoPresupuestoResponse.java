package com.hyskad.taller.web.dto;

import com.hyskad.shared.validation.TipoDocumento;

/** Presupuesto imprimible (RF22): datos del taller, cliente, moto y el presupuesto congelado. */
public record DocumentoPresupuestoResponse(Taller taller, String numeroOrden, Cliente cliente, Moto moto,
        PresupuestoResponse presupuesto, String leyenda) {

    public static final String LEYENDA = "Documento interno. No es factura electrónica.";

    public record Taller(String nombre, String nit, String direccion, String telefono) {
    }

    public record Cliente(String nombreCompleto, TipoDocumento tipoDocumento, String numeroDocumento,
            String telefono) {
    }

    public record Moto(String placa, String marca, String modelo, Integer anio) {
    }
}
