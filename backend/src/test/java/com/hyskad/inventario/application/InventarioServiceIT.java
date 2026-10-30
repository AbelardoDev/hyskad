package com.hyskad.inventario.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Consumer;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

import com.hyskad.catalogo.application.ProductoService;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.inventario.domain.MovimientoInventario;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.inventario.domain.Referencia.TipoReferencia;
import com.hyskad.inventario.domain.StockBajoDetectado;
import com.hyskad.inventario.domain.TipoMovimiento;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.support.CatalogoDePrueba;
import com.hyskad.support.IntegrationTest;

/** Contrato de {@link InventarioService} con MySQL real (RN-07 a RN-15). */
@IntegrationTest
@RecordApplicationEvents
class InventarioServiceIT {

    private static final Referencia COMPRA = new Referencia(TipoReferencia.COMPRA, 1L, "C-000001");
    private static final Referencia VENTA = new Referencia(TipoReferencia.VENTA, 7L, "V-000007");
    private static final Referencia ORDEN = new Referencia(TipoReferencia.ORDEN_TRABAJO, 3L, "OT-000003");

    @Autowired
    private InventarioService inventario;

    @Autowired
    private ProductoService productos;

    @Autowired
    private CatalogoDePrueba catalogo;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ApplicationEvents eventos;

    private static BigDecimal d(String valor) {
        return new BigDecimal(valor);
    }

    @Test
    void cp23CompraRecalculaElCostoPromedioYRegistraElMovimiento() {
        Producto p = catalogo.producto("2");
        inventario.registrarEntradaCompra(p.getId(), d("10"), d("10000"), COMPRA);

        MovimientoInventario movimiento = inventario.registrarEntradaCompra(p.getId(), d("10"), d("12000"), COMPRA);

        Producto actual = productos.obtener(p.getId());
        assertThat(actual.getStockActual()).isEqualByComparingTo("20");
        assertThat(actual.getCostoPromedio()).isEqualByComparingTo("11000");
        assertThat(movimiento.getTipo()).isEqualTo(TipoMovimiento.ENTRADA_COMPRA);
        assertThat(movimiento.getCostoUnitario()).isEqualByComparingTo("12000");
        assertThat(movimiento.getStockResultante()).isEqualByComparingTo("20");
    }

    @Test
    void cp25CadaMovimientoGuardaTipoCostoStockResultanteYReferencia() {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), d("8"), d("5000"), COMPRA);
        BigDecimal costoVenta = inventario.registrarSalidaVenta(p.getId(), d("3"), VENTA);

        assertThat(costoVenta).isEqualByComparingTo("5000");
        List<String> filas = jdbc.queryForList("select concat_ws('|', tipo, cantidad, costo_unitario, stock_resultante, "
                + "referencia_tipo, referencia_id, referencia_numero) from movimiento_inventario where producto_id = ? "
                + "order by id", String.class, p.getId());
        assertThat(filas).containsExactly(
                "ENTRADA_COMPRA|8.00|5000.00|8.00|COMPRA|1|C-000001",
                "SALIDA_VENTA|3.00|5000.00|5.00|VENTA|7|V-000007");
        // El usuario es el autenticado; en procesos internos (como esta prueba) queda vacío
        assertThat(jdbc.queryForObject("select count(*) from movimiento_inventario where producto_id = ? "
                + "and usuario_id is null and fecha is not null", Integer.class, p.getId())).isEqualTo(2);
    }

    @Test
    void reservarYConsumirBajaElStockConUnSoloMovimientoSalidaOrden() {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), d("6"), d("3000"), COMPRA);

        inventario.reservar(p.getId(), d("4"), ORDEN);
        assertThat(productos.obtener(p.getId()).getStockDisponible()).isEqualByComparingTo("2");
        BigDecimal costo = inventario.consumirReserva(p.getId(), d("4"), ORDEN);

        Producto actual = productos.obtener(p.getId());
        assertThat(costo).isEqualByComparingTo("3000");
        assertThat(actual.getStockActual()).isEqualByComparingTo("2");
        assertThat(actual.getStockReservado()).isZero();
        assertThat(jdbc.queryForList("select tipo from movimiento_inventario where producto_id = ? order by id",
                String.class, p.getId())).containsExactly("ENTRADA_COMPRA", "SALIDA_ORDEN");
    }

    @Test
    void liberarDevuelveAlDisponibleSinMovimiento() {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), d("3"), d("3000"), COMPRA);
        inventario.reservar(p.getId(), d("2"), ORDEN);

        inventario.liberarReserva(p.getId(), d("2"), ORDEN);

        assertThat(productos.obtener(p.getId()).getStockDisponible()).isEqualByComparingTo("3");
        assertThat(contarMovimientos(p.getId())).isEqualTo(1);
    }

    @Test
    void devolucionDeVentaEntraAlCostoDeLaVentaYAnulacionDeCompraSaleAlPromedio() {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), d("10"), d("1000"), COMPRA);
        inventario.registrarEntradaCompra(p.getId(), d("10"), d("2000"), COMPRA);
        // RN-09: la venta salió a 1000 (costo de entonces); al anularla entra a ese costo y recalcula
        inventario.registrarDevolucionVenta(p.getId(), d("5"), d("1000"), VENTA);
        assertThat(productos.obtener(p.getId()).getCostoPromedio()).isEqualByComparingTo("1400");

        // RN-17: sale al promedio vigente y no lo recalcula
        assertThat(inventario.registrarSalidaAnulacionCompra(p.getId(), d("10"), COMPRA)).isEqualByComparingTo("1400");
        Producto actual = productos.obtener(p.getId());
        assertThat(actual.getCostoPromedio()).isEqualByComparingTo("1400");
        assertThat(actual.getStockActual()).isEqualByComparingTo("15");
    }

    @Test
    void cp24AjusteDeSalidaQueDejariaElStockBajoLoReservadoDa409() {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), d("5"), d("1000"), COMPRA);
        inventario.reservar(p.getId(), d("4"), ORDEN);

        assertThat(error(() -> inventario.ajustar(new AjustarInventario(p.getId(), TipoAjuste.SALIDA, d("2"), null,
                "Unidades dañadas en bodega")))).isEqualTo(ErrorCode.STOCK_INSUFICIENTE);
        assertThat(productos.obtener(p.getId()).getStockActual()).isEqualByComparingTo("5");
    }

    @Test
    void ajusteDeEntradaConCostoRecalculaYSinCostoUsaElPromedioVigente() {
        Producto p = catalogo.producto("0");
        MovimientoInventario inicial = inventario.ajustar(new AjustarInventario(p.getId(), TipoAjuste.ENTRADA,
                d("10"), d("10000"), "Inventario inicial del producto"));
        MovimientoInventario sinCosto = inventario.ajustar(new AjustarInventario(p.getId(), TipoAjuste.ENTRADA,
                d("2.5"), null, "Sobrante encontrado en conteo"));

        assertThat(inicial.getTipo()).isEqualTo(TipoMovimiento.ENTRADA_AJUSTE);
        assertThat(sinCosto.getCostoUnitario()).isEqualByComparingTo("10000");
        assertThat(sinCosto.getMotivo()).isEqualTo("Sobrante encontrado en conteo");
        Producto actual = productos.obtener(p.getId());
        assertThat(actual.getStockActual()).isEqualByComparingTo("12.5");
        assertThat(actual.getCostoPromedio()).isEqualByComparingTo("10000");
        assertThat(jdbc.queryForObject("select count(*) from auditoria where accion = 'INVENTARIO_AJUSTADO' "
                + "and entidad_id = ?", Integer.class, p.getId())).isEqualTo(2);
    }

    @Test
    void cantidadesYCostosInvalidosSeRechazan() {
        Producto p = catalogo.producto("0");
        for (String cantidad : new String[] { "0", "-1", "1.005" }) {
            assertThat(error(() -> inventario.registrarEntradaCompra(p.getId(), d(cantidad), d("1"), COMPRA)))
                    .isEqualTo(ErrorCode.CANTIDAD_INVALIDA);
        }
        assertThat(error(() -> inventario.registrarEntradaCompra(p.getId(), d("1"), d("-5"), COMPRA)))
                .isEqualTo(ErrorCode.VALIDACION);
        assertThat(error(() -> inventario.reservar(999_999_999L, d("1"), ORDEN)))
                .isEqualTo(ErrorCode.RECURSO_NO_ENCONTRADO);
    }

    @Test
    void productoInactivoSeRechazaEnCualquierMovimiento() {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), d("5"), d("1000"), COMPRA);
        productos.cambiarEstado(p.getId(), false);
        Long id = p.getId();

        List<Consumer<Long>> movimientos = List.of(
                x -> inventario.registrarEntradaCompra(x, d("1"), d("1000"), COMPRA),
                x -> inventario.registrarSalidaVenta(x, d("1"), VENTA),
                x -> inventario.reservar(x, d("1"), ORDEN),
                x -> inventario.liberarReserva(x, d("1"), ORDEN),
                x -> inventario.consumirReserva(x, d("1"), ORDEN),
                x -> inventario.registrarSalidaAnulacionCompra(x, d("1"), COMPRA),
                x -> inventario.ajustar(new AjustarInventario(x, TipoAjuste.ENTRADA, d("1"), null, "Conteo físico mensual")),
                x -> inventario.ajustar(new AjustarInventario(x, TipoAjuste.SALIDA, d("1"), null, "Conteo físico mensual")));
        for (Consumer<Long> movimiento : movimientos) {
            assertThat(error(() -> movimiento.accept(id))).isEqualTo(ErrorCode.PRODUCTO_INACTIVO);
        }
        assertThat(contarMovimientos(id)).isEqualTo(1);

        // Excepción (RN-21 sobre RN-15): anular una venta devuelve el stock aunque el producto esté inactivo
        inventario.registrarDevolucionVenta(id, d("2"), d("1000"), VENTA);
        Producto actual = productos.obtener(id);
        assertThat(actual.getStockActual()).isEqualByComparingTo("7");
        assertThat(actual.isActivo()).isFalse();
    }

    @Test
    void cp26CruzarElMinimoPublicaUnSoloStockBajoDetectado() {
        Producto p = catalogo.producto("3");
        inventario.registrarEntradaCompra(p.getId(), d("6"), d("1000"), COMPRA); // sale de "bajo": sin evento
        eventos.clear();

        inventario.registrarSalidaVenta(p.getId(), d("2"), VENTA); // disponible 4 > 3
        inventario.reservar(p.getId(), d("1"), ORDEN); // disponible 3 = mínimo → cruza
        inventario.registrarSalidaVenta(p.getId(), d("1"), VENTA); // sigue bajo: no se repite
        inventario.consumirReserva(p.getId(), d("1"), ORDEN);

        List<StockBajoDetectado> publicados = eventos.stream(StockBajoDetectado.class).toList();
        assertThat(publicados).hasSize(1);
        assertThat(publicados.getFirst().productoId()).isEqualTo(p.getId());
        assertThat(publicados.getFirst().stockDisponible()).isEqualByComparingTo("3");
        assertThat(publicados.getFirst().stockMinimo()).isEqualByComparingTo("3");

        // Sube por encima del mínimo y vuelve a bajar: se publica de nuevo
        inventario.registrarEntradaCompra(p.getId(), d("5"), d("1000"), COMPRA);
        inventario.registrarSalidaVenta(p.getId(), d("5"), VENTA);
        assertThat(eventos.stream(StockBajoDetectado.class)).hasSize(2);
    }

    @Test
    void veinteReservasSimultaneasSobreStock10DejanExactamenteDiez() throws Exception {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), d("10"), d("1000"), COMPRA);
        int hilos = 20;
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<Boolean>> resultados = new ArrayList<>();
        try (ExecutorService pool = Executors.newFixedThreadPool(hilos)) {
            for (int i = 0; i < hilos; i++) {
                resultados.add(pool.submit(() -> {
                    salida.await();
                    try {
                        inventario.reservar(p.getId(), BigDecimal.ONE, ORDEN);
                        return true;
                    } catch (BusinessException e) {
                        assertThat(e.getCode()).isEqualTo(ErrorCode.STOCK_INSUFICIENTE);
                        return false;
                    }
                }));
            }
            salida.countDown();
            int exitosas = 0;
            for (Future<Boolean> resultado : resultados) {
                exitosas += resultado.get() ? 1 : 0;
            }
            assertThat(exitosas).isEqualTo(10);
        }
        assertThat(jdbc.queryForObject("select stock_reservado from producto where id = ?", BigDecimal.class,
                p.getId())).isEqualByComparingTo("10");
    }

    private int contarMovimientos(Long productoId) {
        return jdbc.queryForObject("select count(*) from movimiento_inventario where producto_id = ?", Integer.class,
                productoId);
    }

    private static ErrorCode error(Runnable accion) {
        try {
            accion.run();
        } catch (BusinessException e) {
            return e.getCode();
        }
        throw new AssertionError("Debía lanzar BusinessException");
    }
}
