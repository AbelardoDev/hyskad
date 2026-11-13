package com.hyskad.taller.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.hyskad.catalogo.domain.Unidad;
import com.hyskad.shared.validation.TipoDocumento;
import com.hyskad.taller.domain.EstadoOrden;

/**
 * Comprobante imprimible de la orden (RF27): taller, cliente, moto, kilometraje, diagnóstico
 * resumido, servicios, repuestos, totales, pago, mecánicos y la leyenda de RN-06, que viaja desde
 * aquí para que ningún cliente la omita. Sin costos ni existencias.
 */
public record ComprobanteOrdenResponse(Taller taller, String numero, EstadoOrden estado, Instant fechaIngreso,
        Instant fechaFinalizacion, Instant fechaEntrega, Cliente cliente, Moto moto, int kilometrajeIngreso,
        Integer kilometrajeInspeccion, String motivoIngreso, String diagnostico, List<String> mecanicos,
        List<Servicio> servicios, List<Repuesto> repuestos, BigDecimal subtotal, BigDecimal descuento,
        BigDecimal ivaPorcentaje, BigDecimal impuesto, BigDecimal total, OrdenResponse.Pago pago,
        String leyenda) {

    public static final String LEYENDA = "Documento interno. No es factura electrónica.";

    /** Largo máximo del diagnóstico en el comprobante; el completo está en el detalle de la orden. */
    public static final int MAX_DIAGNOSTICO = 300;

    public record Taller(String nombre, String nit, String direccion, String telefono) {
    }

    public record Cliente(String nombreCompleto, TipoDocumento tipoDocumento, String numeroDocumento,
            String telefono) {
    }

    public record Moto(String placa, String marca, String modelo, Integer anio, String color) {
    }

    public record Servicio(String descripcion, BigDecimal precio) {
    }

    public record Repuesto(String codigo, String nombre, Unidad unidad, BigDecimal cantidad, BigDecimal precioUnitario,
            BigDecimal subtotal) {
    }

    /** Recorta el diagnóstico a {@link #MAX_DIAGNOSTICO} caracteres, terminando en "…" si se cortó. */
    public static String resumir(String diagnostico) {
        if (diagnostico == null || diagnostico.length() <= MAX_DIAGNOSTICO) {
            return diagnostico;
        }
        return diagnostico.substring(0, MAX_DIAGNOSTICO - 1).stripTrailing() + "…";
    }
}
