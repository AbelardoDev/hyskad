package com.hyskad.ventas.web.dto;

/**
 * Todo lo que imprime el comprobante de venta (RF27): datos del taller, la venta completa y la
 * leyenda de documento interno (RN-06), que viaja desde aquí para que ningún cliente la omita.
 */
public record ComprobanteResponse(Taller taller, VentaResponse venta, String leyenda) {

    public static final String LEYENDA = "Documento interno. No es factura electrónica.";

    public record Taller(String nombre, String nit, String direccion, String telefono) {
    }
}
