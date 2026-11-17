package com.hyskad.inventario.web;

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
import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.shared.web.Csv;
import com.hyskad.usuarios.application.UsuarioService;

/**
 * Arma las respuestas de movimientos (con el nombre de quien los hizo) y el CSV de exportación.
 * El CSV va en UTF-8 con BOM y separado por punto y coma, como lo abre Excel en español.
 */
@Component
class MovimientosWeb {

    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
            .withZone(TiempoConfig.ZONA_NEGOCIO);

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
        Csv csv = Csv.con("fecha", "tipo", "codigo", "producto", "cantidad", "costo_unitario", "stock_resultante",
                "referencia", "motivo", "usuario");
        for (MovimientoInventario m : movimientos) {
            Producto p = m.getProducto();
            csv.fila(FECHA.format(m.getFecha()), m.getTipo().name(), Csv.texto(p.getCodigo()), Csv.texto(p.getNombre()),
                    Csv.numero(m.getCantidad()), Csv.numero(m.getCostoUnitario()), Csv.numero(m.getStockResultante()),
                    Csv.texto(m.getReferenciaNumero()), Csv.texto(m.getMotivo()),
                    Csv.texto(m.getUsuarioId() == null ? null : nombres.get(m.getUsuarioId())));
        }
        return csv.bytes();
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


}
