package com.hyskad.compras.web;

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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.hyskad.catalogo.application.ProductoService;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.support.CatalogoDePrueba;
import com.hyskad.support.Identificadores;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.ObjectMapper;

/** Compras de punta a punta con MySQL real (RF21, RN-07, RN-16, RN-17). */
@IntegrationTest
class CompraControllerIT {

    private static final String BASE = "/api/v1/compras";
    private static final String HOY = LocalDate.now(ZoneId.of("America/Bogota")).toString();

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
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    private String bearer;
    private long proveedor;

    @BeforeEach
    void iniciar() throws Exception {
        bearer = usuarios.bearer(usuarios.crear(Rol.ALMACEN).id());
        proveedor = crearProveedor();
    }

    @Test
    void cp23DosComprasDanStock20YCostoPromedio11000ConMovimientosEntradaCompra() throws Exception {
        Producto p = catalogo.producto("0");

        String primera = registrar(compra(proveedor, factura(), item(p.getId(), "10", "10000")));
        String segunda = mvc.perform(conToken(post(BASE)).content(compra(proveedor, factura(),
                item(p.getId(), "10", "12000"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero").value(matchesPattern("C-\\d{6}")))
                .andExpect(jsonPath("$.estado").value("REGISTRADA"))
                .andExpect(jsonPath("$.subtotal").value(120000))
                .andExpect(jsonPath("$.ivaPorcentaje").value(19))
                .andExpect(jsonPath("$.impuesto").value(22800))
                .andExpect(jsonPath("$.total").value(142800))
                .andExpect(jsonPath("$.items[0].producto.stockActual").value(20))
                .andExpect(jsonPath("$.items[0].producto.costoPromedio").value(11000))
                .andReturn().getResponse().getContentAsString();

        Producto actual = productos.obtener(p.getId());
        assertThat(actual.getStockActual()).isEqualByComparingTo("20");
        assertThat(actual.getCostoPromedio()).isEqualByComparingTo("11000");
        String numero = json.readTree(segunda).get("numero").asString();
        assertThat(jdbc.queryForList("select concat_ws('|', tipo, costo_unitario, referencia_tipo, referencia_numero) "
                + "from movimiento_inventario where producto_id = ? order by id", String.class, p.getId()))
                .containsExactly("ENTRADA_COMPRA|10000.00|COMPRA|" + json.readTree(primera).get("numero").asString(),
                        "ENTRADA_COMPRA|12000.00|COMPRA|" + numero);
        assertThat(jdbc.queryForObject("select count(*) from auditoria where accion = 'COMPRA_REGISTRADA' "
                + "and detalle->>'$.numero' = ?", Integer.class, numero)).isEqualTo(1);
    }

    @Test
    void unProductoInactivoEntreVariosDa400YNoCambiaNada() throws Exception {
        Producto bueno = catalogo.producto("0");
        Producto inactivo = catalogo.producto("0");
        productos.cambiarEstado(inactivo.getId(), false);
        String factura = factura();
        int compras = contarCompras();

        mvc.perform(conToken(post(BASE)).content(compra(proveedor, factura, item(bueno.getId(), "5", "1000"),
                item(inactivo.getId(), "5", "1000"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDACION"))
                .andExpect(jsonPath("$.errors[0].campo").value("items[1].productoId"))
                .andExpect(jsonPath("$.errors[0].code").value("PRODUCTO_INACTIVO"));

        assertThat(productos.obtener(bueno.getId()).getStockActual()).isZero();
        assertThat(contarCompras()).isEqualTo(compras);
        assertThat(jdbc.queryForObject("select count(*) from movimiento_inventario where producto_id = ?",
                Integer.class, bueno.getId())).isZero();
    }

    @Test
    void validaItemsRepetidosOInexistentesFechaFuturaYCantidades() throws Exception {
        Producto p = catalogo.producto("0");
        String manana = LocalDate.parse(HOY).plusDays(1).toString();

        mvc.perform(conToken(post(BASE)).content(compra(proveedor, factura(), item(p.getId(), "1", "1000"),
                item(p.getId(), "2", "1000"), item(999_999_999L, "1", "1000")).replace(HOY, manana)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.campo == 'fecha')].code").value("FECHA_FUTURA"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'items[1].productoId')].code").value("PRODUCTO_REPETIDO"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'items[2].productoId')].code")
                        .value("RECURSO_NO_ENCONTRADO"));
        mvc.perform(conToken(post(BASE)).content(compra(proveedor, factura(), item(p.getId(), "0", "-1"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.campo == 'items[0].cantidad')].code").value("DECIMAL_MIN"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'items[0].costoUnitario')].code").value("DECIMAL_MIN"));
        mvc.perform(conToken(post(BASE)).content("""
                {"proveedorId":%d,"numeroFacturaProveedor":"F-1","fecha":"%s","items":[]}"""
                .formatted(proveedor, HOY)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].campo").value("items"));
    }

    @Test
    void proveedorInactivoYFacturaRepetidaMientrasNoSeAnule() throws Exception {
        Producto p = catalogo.producto("0");
        String factura = factura();
        long id = json.readTree(registrar(compra(proveedor, factura, item(p.getId(), "3", "1000")))).get("id").asLong();

        mvc.perform(conToken(post(BASE)).content(compra(proveedor, " " + factura + " ", item(p.getId(), "1", "1000"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FACTURA_DUPLICADA"));
        mvc.perform(conToken(post(BASE + "/" + id + "/anulacion")).content("{\"motivo\":\"Factura mal digitada\"}"))
                .andExpect(status().isOk());
        registrar(compra(proveedor, factura, item(p.getId(), "1", "1000")));

        long inactivo = crearProveedor();
        mvc.perform(conToken(patch("/api/v1/proveedores/" + inactivo + "/estado")).content("{\"activo\":false}"));
        mvc.perform(conToken(post(BASE)).content(compra(inactivo, factura(), item(p.getId(), "1", "1000"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROVEEDOR_INACTIVO"));
    }

    @Test
    void anularSacaElStockSinCambiarElCostoYNoSeAnulaDosVeces() throws Exception {
        Producto p = catalogo.producto("0");
        registrar(compra(proveedor, factura(), item(p.getId(), "10", "10000")));
        long id = json.readTree(registrar(compra(proveedor, factura(), item(p.getId(), "10", "12000"))))
                .get("id").asLong();

        mvc.perform(conToken(post(BASE + "/" + id + "/anulacion")).content("{\"motivo\":\"Devolución al proveedor\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ANULADA"))
                .andExpect(jsonPath("$.motivoAnulacion").value("Devolución al proveedor"))
                .andExpect(jsonPath("$.anuladaPor.nombre").value("Prueba ALMACEN"))
                .andExpect(jsonPath("$.items[0].producto.stockActual").value(10));

        Producto actual = productos.obtener(p.getId());
        assertThat(actual.getStockActual()).isEqualByComparingTo("10");
        assertThat(actual.getCostoPromedio()).isEqualByComparingTo("11000");
        assertThat(jdbc.queryForObject("select costo_unitario from movimiento_inventario where producto_id = ? "
                + "and tipo = 'SALIDA_ANULACION_COMPRA'", BigDecimal.class, p.getId())).isEqualByComparingTo("11000");
        mvc.perform(conToken(post(BASE + "/" + id + "/anulacion")).content("{\"motivo\":\"Otra vez la misma\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COMPRA_ANULADA"));
        mvc.perform(conToken(post(BASE + "/" + id + "/anulacion")).content("{\"motivo\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cp27NoSeAnulaSiUnProductoNoTieneDisponibleSuficiente() throws Exception {
        Producto vendido = catalogo.producto("0");
        Producto otro = catalogo.producto("0");
        long id = json.readTree(registrar(compra(proveedor, factura(), item(otro.getId(), "4", "500"),
                item(vendido.getId(), "5", "1000")))).get("id").asLong();
        inventario.registrarSalidaVenta(vendido.getId(), new BigDecimal("3"),
                new Referencia(Referencia.TipoReferencia.VENTA, 1L, "V-000001"));

        mvc.perform(conToken(post(BASE + "/" + id + "/anulacion")).content("{\"motivo\":\"Pedido equivocado\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STOCK_INSUFICIENTE"));

        assertThat(productos.obtener(otro.getId()).getStockActual()).isEqualByComparingTo("4");
        assertThat(productos.obtener(vendido.getId()).getStockActual()).isEqualByComparingTo("2");
        assertThat(jdbc.queryForObject("select estado from compra where id = ?", String.class, id))
                .isEqualTo("REGISTRADA");
    }

    @Test
    void listaConFiltrosYSoloParaQuienGestionaCompras() throws Exception {
        Producto p = catalogo.producto("0");
        String factura = factura();
        String numero = json.readTree(registrar(compra(proveedor, factura, item(p.getId(), "1", "1000"))))
                .get("numero").asString();

        mvc.perform(conToken(get(BASE)).param("proveedorId", String.valueOf(proveedor)))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].numero").value(numero))
                .andExpect(jsonPath("$.content[0].items").doesNotExist());
        mvc.perform(conToken(get(BASE)).param("numero", factura.substring(2)).param("estado", "REGISTRADA")
                .param("desde", HOY).param("hasta", HOY))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(conToken(get(BASE)).param("proveedorId", String.valueOf(proveedor)).param("estado", "ANULADA"))
                .andExpect(jsonPath("$.totalElements").value(0));
        for (Rol rol : new Rol[] { Rol.VENDEDOR, Rol.MECANICO }) {
            mvc.perform(get(BASE).header(HttpHeaders.AUTHORIZATION, usuarios.bearer(usuarios.crear(rol).id())))
                    .andExpect(status().isForbidden());
        }
    }

    private String registrar(String cuerpo) throws Exception {
        return mvc.perform(conToken(post(BASE)).content(cuerpo)).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    private long crearProveedor() throws Exception {
        String respuesta = mvc.perform(conToken(post("/api/v1/proveedores")).content("""
                {"tipoDocumento":"NIT","numeroDocumento":"%s","razonSocial":"Proveedor %s"}"""
                .formatted(Identificadores.nit(), CatalogoDePrueba.unico())))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(respuesta).get("id").asLong();
    }

    private int contarCompras() {
        return jdbc.queryForObject("select count(*) from compra", Integer.class);
    }

    private MockHttpServletRequestBuilder conToken(MockHttpServletRequestBuilder peticion) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearer).contentType(MediaType.APPLICATION_JSON);
    }

    private static String factura() {
        return "FE-" + CatalogoDePrueba.unico();
    }

    private static String item(Long productoId, String cantidad, String costo) {
        return """
                {"productoId":%d,"cantidad":%s,"costoUnitario":%s}""".formatted(productoId, cantidad, costo);
    }

    private static String compra(long proveedorId, String factura, String... items) {
        return """
                {"proveedorId":%d,"numeroFacturaProveedor":"%s","fecha":"%s","items":[%s]}"""
                .formatted(proveedorId, factura, HOY, String.join(",", items));
    }
}
