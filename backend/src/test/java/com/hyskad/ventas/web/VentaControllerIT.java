package com.hyskad.ventas.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.hyskad.catalogo.application.ProductoService;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.support.CatalogoDePrueba;
import com.hyskad.support.Identificadores;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.ventas.application.RegistrarVenta;
import com.hyskad.ventas.application.VentaService;
import com.hyskad.ventas.domain.MetodoPago;
import com.hyskad.ventas.domain.VentaAnulada;

import tools.jackson.databind.ObjectMapper;

/** Ventas de mostrador de punta a punta con MySQL real (RN-18 a RN-21). */
@IntegrationTest
@RecordApplicationEvents
class VentaControllerIT {

    private static final String BASE = "/api/v1/ventas";
    private static final Referencia COMPRA = new Referencia(Referencia.TipoReferencia.COMPRA, 1L, "C-1");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private CatalogoDePrueba catalogo;

    @Autowired
    private ProductoService productos;

    @Autowired
    private InventarioService inventario;

    @Autowired
    private VentaService ventas;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private ApplicationEvents eventos;

    private UsuariosDePrueba.Creado vendedor;
    private String bearer;

    @BeforeEach
    void iniciar() {
        vendedor = usuarios.crear(Rol.VENDEDOR);
        bearer = usuarios.bearer(vendedor.id());
    }

    /** Producto a $25.000 (precio de `CatalogoDePrueba`) con stock al costo dado. */
    private Producto conStock(String stock, String costo) {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), new BigDecimal(stock), new BigDecimal(costo), COMPRA);
        return p;
    }

    @Test
    void ventaEnEfectivoConDescuentoIvaYCambioALosPreciosVigentes() throws Exception {
        Producto a = conStock("10", "15000");
        Producto b = conStock("5", "8000");

        // 2 × 25.000 + 1,5 × 25.000 = 87.500 − 7.500 = 80.000 + IVA 15.200 = 95.200
        String respuesta = mvc.perform(conToken(post(BASE)).content("""
                {"items":[{"productoId":%d,"cantidad":2},{"productoId":%d,"cantidad":1.5}],"descuento":7500,
                 "metodoPago":"EFECTIVO","referenciaPago":"ignorada","montoRecibido":100000}"""
                .formatted(a.getId(), b.getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero").value(matchesPattern("V-\\d{6}")))
                .andExpect(jsonPath("$.estado").value("PAGADA"))
                .andExpect(jsonPath("$.cliente").doesNotExist())
                .andExpect(jsonPath("$.items[0].precioUnitario").value(25000))
                .andExpect(jsonPath("$.items[1].subtotal").value(37500))
                .andExpect(jsonPath("$.subtotal").value(87500))
                .andExpect(jsonPath("$.descuento").value(7500))
                .andExpect(jsonPath("$.impuesto").value(15200))
                .andExpect(jsonPath("$.total").value(95200))
                .andExpect(jsonPath("$.referenciaPago").doesNotExist())
                .andExpect(jsonPath("$.montoRecibido").value(100000))
                .andExpect(jsonPath("$.cambio").value(4800))
                .andExpect(jsonPath("$.vendedor.id").value(vendedor.id()))
                .andExpect(jsonPath("$.items[0].costoUnitario").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(respuesta).get("id").asLong();

        assertThat(productos.obtener(a.getId()).getStockActual()).isEqualByComparingTo("8");
        assertThat(productos.obtener(b.getId()).getStockActual()).isEqualByComparingTo("3.5");
        // Precio y costo congelados en el detalle
        assertThat(jdbc.queryForList("select concat_ws('|', precio_unitario, costo_unitario) from venta_detalle "
                + "where venta_id = ? order by id", String.class, id))
                .containsExactly("25000.00|15000.00", "25000.00|8000.00");
        assertThat(jdbc.queryForObject("select count(*) from movimiento_inventario where tipo = 'SALIDA_VENTA' "
                + "and referencia_id = ?", Integer.class, id)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select created_by from venta where id = ?", Long.class, id))
                .isEqualTo(vendedor.id());
    }

    @Test
    void elClienteNoPuedeEnviarPrecios() throws Exception {
        Producto p = conStock("3", "1000");
        mvc.perform(conToken(post(BASE)).content("""
                {"items":[{"productoId":%d,"cantidad":1,"precioUnitario":1}],"descuento":0,"metodoPago":"EFECTIVO"}"""
                .formatted(p.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("PROPIEDAD_DESCONOCIDA"));
        assertThat(productos.obtener(p.getId()).getStockActual()).isEqualByComparingTo("3");
    }

    @Test
    void cp30VenderMasQueElDisponibleDa409YNoCambiaNada() throws Exception {
        Producto otro = conStock("10", "1000");
        Producto escaso = conStock("2", "1000");
        inventario.reservar(escaso.getId(), BigDecimal.ONE,
                new Referencia(Referencia.TipoReferencia.ORDEN_TRABAJO, 1L, "OT-1"));
        int ventasAntes = contarVentas();

        mvc.perform(conToken(post(BASE)).content(venta(otro.getId(), "1") .replace("]", ",{\"productoId\":"
                + escaso.getId() + ",\"cantidad\":2}]")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STOCK_INSUFICIENTE"));

        assertThat(productos.obtener(otro.getId()).getStockActual()).isEqualByComparingTo("10");
        assertThat(productos.obtener(escaso.getId()).getStockActual()).isEqualByComparingTo("2");
        assertThat(contarVentas()).isEqualTo(ventasAntes);
    }

    @Test
    void cp31DosVentasSimultaneasDeLaUltimaUnidadSoloUnaConfirma() throws Exception {
        Producto p = conStock("1", "1000");
        RegistrarVenta datos = new RegistrarVenta(null, List.of(new RegistrarVenta.Item(p.getId(), BigDecimal.ONE)),
                BigDecimal.ZERO, MetodoPago.EFECTIVO, null, null);
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<Boolean>> resultados = new ArrayList<>();
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            for (int i = 0; i < 2; i++) {
                resultados.add(pool.submit(() -> {
                    salida.await();
                    try {
                        ventas.registrar(datos);
                        return true;
                    } catch (BusinessException e) {
                        assertThat(e.getCode()).isEqualTo(ErrorCode.STOCK_INSUFICIENTE);
                        return false;
                    }
                }));
            }
            salida.countDown();
            int exitosas = 0;
            for (Future<Boolean> r : resultados) {
                exitosas += r.get() ? 1 : 0;
            }
            assertThat(exitosas).isEqualTo(1);
        }
        assertThat(productos.obtener(p.getId()).getStockActual()).isZero();
    }

    @Test
    void cp32AnularDevuelveElStockAlCostoDeLaVentaYPublicaElEvento() throws Exception {
        Producto p = conStock("10", "1000");
        long id = registrar(venta(p.getId(), "4"));
        // Después de la venta el costo promedio cambia; la devolución entra al costo de la venta (RN-09)
        inventario.registrarEntradaCompra(p.getId(), new BigDecimal("6"), new BigDecimal("3000"), COMPRA);
        eventos.clear();
        String bearerAdmin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());

        mvc.perform(post(BASE + "/" + id + "/anulacion").header(HttpHeaders.AUTHORIZATION, bearerAdmin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"El cliente devolvió todo\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ANULADA"))
                .andExpect(jsonPath("$.motivoAnulacion").value("El cliente devolvió todo"))
                .andExpect(jsonPath("$.anuladaPor.nombre").value("Prueba ADMIN"));

        assertThat(productos.obtener(p.getId()).getStockActual()).isEqualByComparingTo("16");
        assertThat(jdbc.queryForObject("select costo_unitario from movimiento_inventario where tipo = "
                + "'DEVOLUCION_ANULACION_VENTA' and referencia_id = ?", BigDecimal.class, id))
                .isEqualByComparingTo("1000");
        assertThat(eventos.stream(VentaAnulada.class)).singleElement()
                .satisfies(e -> assertThat(e.ventaId()).isEqualTo(id));
        mvc.perform(post(BASE + "/" + id + "/anulacion").header(HttpHeaders.AUTHORIZATION, bearerAdmin)
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"Otra vez la misma\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VENTA_ANULADA"));
    }

    @Test
    void anularDevuelveAunqueElProductoSeHayaDesactivadoDespues() throws Exception {
        Producto p = conStock("5", "1000");
        long id = registrar(venta(p.getId(), "5"));
        productos.cambiarEstado(p.getId(), false);

        mvc.perform(post(BASE + "/" + id + "/anulacion")
                .header(HttpHeaders.AUTHORIZATION, usuarios.bearer(usuarios.crear(Rol.ADMIN).id()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"Producto retirado del catálogo\"}"))
                .andExpect(status().isOk());

        Producto actual = productos.obtener(p.getId());
        assertThat(actual.getStockActual()).isEqualByComparingTo("5");
        assertThat(actual.isActivo()).isFalse();
    }

    @Test
    void cp33ElVendedorNoAnulaYElMecanicoNoVeVentas() throws Exception {
        Producto p = conStock("3", "1000");
        long id = registrar(venta(p.getId(), "1"));

        mvc.perform(conToken(post(BASE + "/" + id + "/anulacion")).content("{\"motivo\":\"Me equivoqué\"}"))
                .andExpect(status().isForbidden());
        String mecanico = usuarios.bearer(usuarios.crear(Rol.MECANICO).id());
        mvc.perform(get(BASE).header(HttpHeaders.AUTHORIZATION, mecanico)).andExpect(status().isForbidden());
        String almacen = usuarios.bearer(usuarios.crear(Rol.ALMACEN).id());
        mvc.perform(get(BASE + "/" + id).header(HttpHeaders.AUTHORIZATION, almacen)).andExpect(status().isOk());
        mvc.perform(post(BASE).header(HttpHeaders.AUTHORIZATION, almacen).contentType(MediaType.APPLICATION_JSON)
                .content(venta(p.getId(), "1"))).andExpect(status().isForbidden());
    }

    @Test
    void validaPagoDescuentoClienteEItems() throws Exception {
        Producto p = conStock("3", "1000");
        Producto inactivo = conStock("3", "1000");
        productos.cambiarEstado(inactivo.getId(), false);

        mvc.perform(conToken(post(BASE)).content(venta(p.getId(), "1").replace("\"EFECTIVO\"", "\"TARJETA\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].campo").value("referenciaPago"))
                .andExpect(jsonPath("$.errors[0].code").value("REFERENCIA_REQUERIDA"));
        mvc.perform(conToken(post(BASE)).content(venta(p.getId(), "1").replace("\"descuento\":0", "\"descuento\":25001")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("DESCUENTO_INVALIDO"));
        mvc.perform(conToken(post(BASE)).content(venta(p.getId(), "1").replace("\"EFECTIVO\"", "\"EFECTIVO\",\"montoRecibido\":20000")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].campo").value("montoRecibido"))
                .andExpect(jsonPath("$.errors[0].code").value("MONTO_INSUFICIENTE"));
        mvc.perform(conToken(post(BASE)).content("""
                {"items":[{"productoId":%d,"cantidad":1},{"productoId":%d,"cantidad":1}],"descuento":0,
                 "metodoPago":"EFECTIVO"}""".formatted(p.getId(), inactivo.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].campo").value("items[1].productoId"))
                .andExpect(jsonPath("$.errors[0].code").value("PRODUCTO_INACTIVO"));

        long cliente = crearCliente();
        mvc.perform(conToken(patch("/api/v1/clientes/" + cliente + "/estado")).content("{\"activo\":false}"));
        mvc.perform(conToken(post(BASE)).content(venta(p.getId(), "1").replace("{\"items\"",
                "{\"clienteId\":" + cliente + ",\"items\"")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLIENTE_INACTIVO"));
        assertThat(productos.obtener(p.getId()).getStockActual()).isEqualByComparingTo("3");
    }

    @Test
    void conClienteTransferenciaYComprobanteConLeyenda() throws Exception {
        Producto p = conStock("3", "1000");
        long cliente = crearCliente();
        long id = registrar("""
                {"clienteId":%d,"items":[{"productoId":%d,"cantidad":1}],"descuento":0,"metodoPago":"TRANSFERENCIA",
                 "referenciaPago":" NEQUI-123 ","montoRecibido":999999}""".formatted(cliente, p.getId()));

        mvc.perform(conToken(get(BASE + "/" + id + "/comprobante")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taller.nombre").value("Taller HYSKAD"))
                .andExpect(jsonPath("$.taller.nit").value("900123456-8"))
                .andExpect(jsonPath("$.venta.cliente.nombreCompleto").value("Comprador Prueba"))
                .andExpect(jsonPath("$.venta.referenciaPago").value("NEQUI-123"))
                .andExpect(jsonPath("$.venta.montoRecibido").doesNotExist())
                .andExpect(jsonPath("$.venta.ivaPorcentaje").value(19))
                .andExpect(jsonPath("$.venta.vendedor.nombre").value("Prueba VENDEDOR"))
                .andExpect(jsonPath("$.leyenda").value("Documento interno. No es factura electrónica."));
    }

    @Test
    void listaYResumenConFiltros() throws Exception {
        Producto p = conStock("10", "1000");
        String hoy = LocalDate.now(ZoneId.of("America/Bogota")).toString();
        long primera = registrar(venta(p.getId(), "1"));
        registrar(venta(p.getId(), "2"));
        mvc.perform(post(BASE + "/" + primera + "/anulacion")
                .header(HttpHeaders.AUTHORIZATION, usuarios.bearer(usuarios.crear(Rol.ADMIN).id()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"Prueba de anulación\"}"));

        mvc.perform(conToken(get(BASE)).param("vendedorId", String.valueOf(vendedor.id())))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].vendedor.nombre").value("Prueba VENDEDOR"))
                .andExpect(jsonPath("$.content[0].items").doesNotExist());
        // 2 × 25.000 + IVA 9.500 = 59.500 (la anulada no cuenta con estado PAGADA)
        mvc.perform(conToken(get(BASE + "/resumen")).param("vendedorId", String.valueOf(vendedor.id()))
                .param("estado", "PAGADA").param("desde", hoy).param("hasta", hoy))
                .andExpect(jsonPath("$.cantidad").value(1))
                .andExpect(jsonPath("$.total").value(59500));
        mvc.perform(conToken(get(BASE)).param("vendedorId", String.valueOf(vendedor.id()))
                .param("estado", "ANULADA").param("metodo", "EFECTIVO"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(primera));
    }

    private long registrar(String cuerpo) throws Exception {
        return json.readTree(mvc.perform(conToken(post(BASE)).content(cuerpo)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).get("id").asLong();
    }

    private long crearCliente() throws Exception {
        String respuesta = mvc.perform(conToken(post("/api/v1/clientes")).content("""
                {"tipoDocumento":"CC","numeroDocumento":"%s","nombres":"Comprador","apellidos":"Prueba",
                 "telefono":"3001234567","aceptaTratamientoDatos":true}""".formatted(Identificadores.cedula())))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(respuesta).get("id").asLong();
    }

    private int contarVentas() {
        return jdbc.queryForObject("select count(*) from venta", Integer.class);
    }

    private MockHttpServletRequestBuilder conToken(MockHttpServletRequestBuilder peticion) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearer).contentType(MediaType.APPLICATION_JSON);
    }

    private static String venta(Long productoId, String cantidad) {
        return """
                {"items":[{"productoId":%d,"cantidad":%s}],"descuento":0,"metodoPago":"EFECTIVO"}"""
                .formatted(productoId, cantidad);
    }
}
