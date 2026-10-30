package com.hyskad.catalogo.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;

/** Reglas de existencias del producto: RN-07, RN-08, RN-10, RN-13, RN-14, RN-15. */
class ProductoTest {

    private static BigDecimal d(String valor) {
        return new BigDecimal(valor);
    }

    private static Producto producto(String minimo) {
        return new Producto(new DatosProducto("FIL-01", "Filtro", null, "Marca", Unidad.UNIDAD, d("16000"), d(minimo)),
                new Categoria("Filtros", null));
    }

    private static ErrorCode codigo(Runnable accion) {
        try {
            accion.run();
        } catch (BusinessException e) {
            return e.getCode();
        }
        throw new AssertionError("No lanzó BusinessException");
    }

    @Test
    void naceSinExistenciasNiCostoYAgotado() {
        Producto p = producto("2");
        assertThat(p.getStockActual()).isZero();
        assertThat(p.getCostoPromedio()).isZero();
        assertThat(p.getEstadoStock()).isEqualTo(EstadoStock.AGOTADO);
        assertThat(p.estaBajo()).isTrue();
    }

    @Test
    void entradaRecalculaElCostoYSalidaLoConserva() {
        Producto p = producto("2");
        p.registrarEntrada(d("10"), d("10000"));
        p.registrarEntrada(d("10"), d("12000"));

        assertThat(p.registrarSalida(d("4"))).isEqualByComparingTo("11000");
        assertThat(p.getCostoPromedio()).isEqualByComparingTo("11000");
        assertThat(p.getStockActual()).isEqualByComparingTo("16");
        assertThat(p.getEstadoStock()).isEqualTo(EstadoStock.OK);
    }

    @Test
    void reservarApartaDelDisponibleYConsumirBajaAmbos() {
        Producto p = producto("1");
        p.registrarEntrada(d("5"), d("1000"));
        p.reservar(d("3"));
        assertThat(p.getStockDisponible()).isEqualByComparingTo("2");

        assertThat(p.consumirReserva(d("2"))).isEqualByComparingTo("1000");
        assertThat(p.getStockActual()).isEqualByComparingTo("3");
        assertThat(p.getStockReservado()).isEqualByComparingTo("1");

        p.liberarReserva(d("1"));
        assertThat(p.getStockReservado()).isZero();
    }

    @Test
    void noSaleNiSeReservaMasQueElDisponibleNiSeLiberaMasQueLoReservado() {
        Producto p = producto("0");
        p.registrarEntrada(d("5"), d("1000"));
        p.reservar(d("4"));

        // RN-13: una salida no puede dejar el stock por debajo de lo reservado
        assertThat(codigo(() -> p.registrarSalida(d("2")))).isEqualTo(ErrorCode.STOCK_INSUFICIENTE);
        assertThat(codigo(() -> p.reservar(d("1.5")))).isEqualTo(ErrorCode.STOCK_INSUFICIENTE);
        assertThat(codigo(() -> p.liberarReserva(d("5")))).isEqualTo(ErrorCode.RESERVA_INSUFICIENTE);
        assertThat(codigo(() -> p.consumirReserva(d("4.01")))).isEqualTo(ErrorCode.RESERVA_INSUFICIENTE);
        assertThat(p.getStockActual()).isEqualByComparingTo("5");
        assertThat(p.getStockReservado()).isEqualByComparingTo("4");
    }

    @Test
    void estadoDeStockFrenteAlMinimo() {
        Producto p = producto("3");
        p.registrarEntrada(d("4"), d("1000"));
        assertThat(p.getEstadoStock()).isEqualTo(EstadoStock.OK);
        p.registrarSalida(d("1"));
        assertThat(p.getEstadoStock()).isEqualTo(EstadoStock.BAJO);
        p.registrarSalida(d("3"));
        assertThat(p.getEstadoStock()).isEqualTo(EstadoStock.AGOTADO);
    }

    @Test
    void inactivoNoAdmiteNingunMovimientoYNoSeDesactivaConReservas() {
        Producto p = producto("0");
        p.registrarEntrada(d("5"), d("1000"));
        p.reservar(d("1"));
        assertThat(codigo(() -> p.cambiarEstado(false))).isEqualTo(ErrorCode.RESERVA_PENDIENTE);

        p.liberarReserva(d("1"));
        p.cambiarEstado(false);
        assertThat(p.isActivo()).isFalse();
        for (Runnable movimiento : new Runnable[] {
                () -> p.registrarEntrada(d("1"), d("1000")), () -> p.registrarSalida(d("1")),
                () -> p.reservar(d("1")), () -> p.liberarReserva(d("1")), () -> p.consumirReserva(d("1")) }) {
            assertThat(codigo(movimiento)).isEqualTo(ErrorCode.PRODUCTO_INACTIVO);
        }
        assertThatThrownBy(() -> p.registrarSalida(d("1"))).hasMessageContaining("inactivo");
        // La devolución de una venta anulada sí entra (RN-21)
        p.registrarDevolucion(d("2"), d("1000"));
        assertThat(p.getStockActual()).isEqualByComparingTo("7");
    }
}
