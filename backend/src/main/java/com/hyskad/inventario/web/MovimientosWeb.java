package com.hyskad.inventario.web;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.inventario.domain.MovimientoInventario;
import com.hyskad.inventario.web.dto.MovimientoResponse;
import com.hyskad.usuarios.application.UsuarioService;

/**
 * Arma las respuestas de movimientos (con el nombre de quien los hizo) y el CSV de exportación.
 * El CSV va en UTF-8 con BOM y separado por punto y coma, como lo abre Excel en español.
 */
@Component
class MovimientosWeb {

    static final ZoneId ZONA = ZoneId.of("America/Bogota");
    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZONA);
    private static final String SEPARADOR = ";";
    private static final String BOM = "﻿";
    private static final List<String> ENCABEZADOS = List.of("fecha", "tipo", "codigo", "producto", "cantidad",
            "costo_unitario", "stock_resultante", "referencia", "motivo", "usuario");

    private final UsuarioService usuarios;

    MovimientosWeb(UsuarioService usuarios) {
        this.usuarios = usuarios;
    }

    List<MovimientoResponse> respuestas(Collection<MovimientoInventario> movimientos) {
        Map<Long, String> nombres = nombresDe(movimientos);
        return movimientos.stream().map(m -> respuesta(m, nombres)).toList();
    }

    MovimientoResponse respuesta(MovimientoInventario movimiento) {
        return respuestas(List.of(movimiento)).getFirst();
    }

    byte[] csv(List<MovimientoInventario> movimientos) {
        Map<Long, String> nombres = nombresDe(movimientos);
        StringBuilder csv = new StringBuilder(BOM).append(String.join(SEPARADOR, ENCABEZADOS)).append("\r\n");
        for (MovimientoInventario m : movimientos) {
            Producto p = m.getProducto();
            csv.append(String.join(SEPARADOR,
                    FECHA.format(m.getFecha()),
                    m.getTipo().name(),
                    celda(p.getCodigo()),
                    celda(p.getNombre()),
                    numero(m.getCantidad()),
                    numero(m.getCostoUnitario()),
                    numero(m.getStockResultante()),
                    celda(m.getReferenciaNumero()),
                    celda(m.getMotivo()),
                    celda(m.getUsuarioId() == null ? null : nombres.get(m.getUsuarioId()))))
                    .append("\r\n");
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private MovimientoResponse respuesta(MovimientoInventario m, Map<Long, String> nombres) {
        Producto p = m.getProducto();
        return new MovimientoResponse(m.getId(), m.getFecha(), m.getTipo(), m.getCantidad(), m.getCostoUnitario(),
                m.getStockResultante(),
                new MovimientoResponse.ProductoResumen(p.getId(), p.getCodigo(), p.getNombre(), p.getUnidad()),
                m.getReferenciaTipo() == null ? null
                        : new MovimientoResponse.ReferenciaResumen(m.getReferenciaTipo(), m.getReferenciaId(),
                                m.getReferenciaNumero()),
                m.getMotivo(),
                m.getUsuarioId() == null ? null
                        : new MovimientoResponse.UsuarioResumen(m.getUsuarioId(), nombres.get(m.getUsuarioId())));
    }

    private Map<Long, String> nombresDe(Collection<MovimientoInventario> movimientos) {
        return usuarios.nombres(movimientos.stream().map(MovimientoInventario::getUsuarioId).filter(Objects::nonNull)
                .collect(Collectors.toSet()));
    }

    private static String numero(BigDecimal valor) {
        return valor.stripTrailingZeros().toPlainString();
    }

    /**
     * Texto entre comillas (duplicando las internas). Si empieza por {@code = + - @} se antepone un
     * apóstrofo para que la hoja de cálculo no lo ejecute como fórmula (inyección CSV).
     */
    static String celda(String valor) {
        if (valor == null) {
            return "";
        }
        String seguro = valor.matches("^[=+\\-@\\t\\r].*") ? "'" + valor : valor;
        return "\"" + seguro.replace("\"", "\"\"") + "\"";
    }
}
