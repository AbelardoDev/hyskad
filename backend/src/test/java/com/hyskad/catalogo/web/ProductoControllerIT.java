package com.hyskad.catalogo.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.support.CatalogoDePrueba;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.ObjectMapper;

@IntegrationTest
class ProductoControllerIT {

    private static final String BASE = "/api/v1/productos";
    private static final Referencia ORDEN = new Referencia(Referencia.TipoReferencia.ORDEN_TRABAJO, 1L, "OT-1");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private CatalogoDePrueba catalogo;

    @Autowired
    private InventarioService inventario;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    private String bearerAlmacen;
    private Long categoria;

    @BeforeEach
    void iniciar() {
        bearerAlmacen = usuarios.bearer(usuarios.crear(Rol.ALMACEN).id());
        categoria = catalogo.categoria();
    }

    static Stream<Arguments> escrituras() {
        String producto = """
                {"codigo":"X-1","nombre":"X","categoriaId":1,"unidad":"UNIDAD","precioVenta":1000,"stockMinimo":0}""";
        return Stream.of(
                Arguments.of(HttpMethod.POST, BASE, producto),
                Arguments.of(HttpMethod.PUT, BASE + "/1", producto),
                Arguments.of(HttpMethod.PATCH, BASE + "/1/estado", "{\"activo\":false}"),
                Arguments.of(HttpMethod.POST, "/api/v1/categorias", "{\"nombre\":\"X\"}"),
                Arguments.of(HttpMethod.PUT, "/api/v1/categorias/1", "{\"nombre\":\"X\"}"),
                Arguments.of(HttpMethod.PATCH, "/api/v1/categorias/1/estado", "{\"activo\":false}"));
    }

    @ParameterizedTest(name = "{0} {1} como vendedor o mecánico → 403")
    @MethodSource("escrituras")
    void soloQuienGestionaProductosModificaElCatalogo(HttpMethod metodo, String ruta, String cuerpo) throws Exception {
        for (Rol rol : new Rol[] { Rol.VENDEDOR, Rol.MECANICO }) {
            mvc.perform(MockMvcRequestBuilders.request(metodo, ruta).contentType(MediaType.APPLICATION_JSON)
                    .content(cuerpo).header(HttpHeaders.AUTHORIZATION, bearerDe(rol)))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(MockMvcRequestBuilders.request(metodo, ruta).contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void creaElProductoConCodigoEnMayusculasYStockEnCero() throws Exception {
        String codigo = "fil-" + CatalogoDePrueba.unico().toLowerCase();

        mvc.perform(comoAlmacen(post(BASE)).content(producto(codigo, categoria)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.codigo").value(codigo.toUpperCase()))
                .andExpect(jsonPath("$.categoria.id").value(categoria))
                .andExpect(jsonPath("$.precioVenta").value(16000))
                .andExpect(jsonPath("$.costoPromedio").value(0))
                .andExpect(jsonPath("$.stockActual").value(0))
                .andExpect(jsonPath("$.stockDisponible").value(0))
                .andExpect(jsonPath("$.estadoStock").value("AGOTADO"));
        assertThat(jdbc.queryForObject("select count(*) from auditoria a join producto p on p.id = a.entidad_id "
                + "where a.accion = 'PRODUCTO_CREADO' and p.codigo = ?", Integer.class, codigo.toUpperCase()))
                .isEqualTo(1);
    }

    @Test
    void cp22CodigoDuplicadoDa409SinImportarMayusculas() throws Exception {
        String codigo = "DUP-" + CatalogoDePrueba.unico();
        mvc.perform(comoAlmacen(post(BASE)).content(producto(codigo, categoria))).andExpect(status().isCreated());

        mvc.perform(comoAlmacen(post(BASE)).content(producto(" " + codigo.toLowerCase() + " ", categoria)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CODIGO_DUPLICADO"));
    }

    @Test
    void validaPrecioMinimoUnidadYQueElStockNoSeEditeDesdeElCatalogo() throws Exception {
        mvc.perform(comoAlmacen(post(BASE)).content("""
                {"codigo":"MAL CÓDIGO","nombre":"","categoriaId":%d,"unidad":"UNIDAD","precioVenta":0,
                 "stockMinimo":-1}""".formatted(categoria)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.campo == 'codigo')].code").value("CODIGO_INVALIDO"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'nombre')].code").value("NOT_BLANK"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'precioVenta')].code").value("DECIMAL_MIN"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'stockMinimo')].code").value("DECIMAL_MIN"));
        mvc.perform(comoAlmacen(post(BASE)).content(producto("U-" + CatalogoDePrueba.unico(), categoria)
                .replace("\"UNIDAD\"", "\"CAJA\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].campo").value("unidad"));
        mvc.perform(comoAlmacen(post(BASE)).content(producto("S-" + CatalogoDePrueba.unico(), categoria)
                .replace("\"stockMinimo\"", "\"stockActual\":50,\"stockMinimo\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("PROPIEDAD_DESCONOCIDA"));
    }

    @Test
    void mecanicoYVendedorVenProductosSinCostoPromedio() throws Exception {
        Producto p = catalogo.producto("1");
        inventario.registrarEntradaCompra(p.getId(), new BigDecimal("4"), new BigDecimal("9000"), null);

        for (Rol rol : new Rol[] { Rol.MECANICO, Rol.VENDEDOR }) {
            String bearer = bearerDe(rol);
            mvc.perform(get(BASE + "/" + p.getId()).header(HttpHeaders.AUTHORIZATION, bearer))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.stockDisponible").value(4))
                    .andExpect(jsonPath("$.costoPromedio").doesNotExist());
            mvc.perform(get(BASE).param("q", p.getCodigo()).header(HttpHeaders.AUTHORIZATION, bearer))
                    .andExpect(jsonPath("$.content[0].costoPromedio").doesNotExist());
        }
        mvc.perform(comoAlmacen(get(BASE + "/" + p.getId())))
                .andExpect(jsonPath("$.costoPromedio").value(9000));
    }

    @Test
    void filtraPorTextoCategoriaYStockBajo() throws Exception {
        Long otra = catalogo.categoria();
        Producto bajo = crearEn(otra, "1");
        Producto ok = crearEn(otra, "1");
        inventario.registrarEntradaCompra(ok.getId(), new BigDecimal("5"), new BigDecimal("1000"), null);
        inventario.registrarEntradaCompra(bajo.getId(), new BigDecimal("1"), new BigDecimal("1000"), null);

        mvc.perform(comoAlmacen(get(BASE)).param("categoriaId", String.valueOf(otra)))
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(comoAlmacen(get(BASE)).param("categoriaId", String.valueOf(otra)).param("soloStockBajo", "true"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(bajo.getId()))
                .andExpect(jsonPath("$.content[0].estadoStock").value("BAJO"));
        mvc.perform(comoAlmacen(get(BASE)).param("q", ok.getCodigo().toLowerCase()))
                .andExpect(jsonPath("$.content[0].id").value(ok.getId()));
        mvc.perform(comoAlmacen(get(BASE + "/stock-bajo")))
                .andExpect(jsonPath("$[*].id", hasItem(bajo.getId().intValue())))
                .andExpect(jsonPath("$[*].id", not(hasItem(ok.getId().intValue()))))
                .andExpect(jsonPath("$[*].activo", everyItem(org.hamcrest.Matchers.is(true))));
    }

    @Test
    void noSeDesactivaConReservasYUnaCategoriaInactivaNoSeAsigna() throws Exception {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), new BigDecimal("2"), new BigDecimal("1000"), null);
        inventario.reservar(p.getId(), BigDecimal.ONE, ORDEN);

        mvc.perform(comoAlmacen(patch(BASE + "/" + p.getId() + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("RESERVA_PENDIENTE"));

        Long inactiva = catalogo.categoria();
        mvc.perform(comoAlmacen(patch("/api/v1/categorias/" + inactiva + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isOk());
        mvc.perform(comoAlmacen(post(BASE)).content(producto("I-" + CatalogoDePrueba.unico(), inactiva)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATEGORIA_INACTIVA"));
    }

    @Test
    void editaElCatalogoSinTocarExistenciasYAudita() throws Exception {
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), new BigDecimal("3"), new BigDecimal("1000"), null);

        mvc.perform(comoAlmacen(put(BASE + "/" + p.getId())).content("""
                {"codigo":"%s","nombre":"Nuevo nombre","categoriaId":%d,"unidad":"UNIDAD","precioVenta":30000,
                 "stockMinimo":0}""".formatted(p.getCodigo(), p.getCategoria().getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Nuevo nombre"))
                .andExpect(jsonPath("$.stockActual").value(3));
        assertThat(jdbc.queryForObject("select detalle->>'$.campos' from auditoria where accion = "
                + "'PRODUCTO_ACTUALIZADO' and entidad_id = ?", String.class, p.getId()))
                .isEqualTo("[\"nombre\", \"marca\", \"precioVenta\"]");
    }

    @Test
    void categoriasConNombreUnicoYListadoParaTodosLosQueVenProductos() throws Exception {
        String nombre = "Repuestos " + CatalogoDePrueba.unico();
        mvc.perform(comoAlmacen(post("/api/v1/categorias")).content("{\"nombre\":\"" + nombre + "\"}"))
                .andExpect(status().isCreated());
        mvc.perform(comoAlmacen(post("/api/v1/categorias")).content("{\"nombre\":\" " + nombre + " \"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATEGORIA_DUPLICADA"));
        mvc.perform(get("/api/v1/categorias").param("activo", "true").header(HttpHeaders.AUTHORIZATION,
                bearerDe(Rol.MECANICO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].nombre", hasItem(nombre)));
    }

    private Producto crearEn(Long categoriaId, String minimo) throws Exception {
        String respuesta = mvc.perform(comoAlmacen(post(BASE)).content(producto("F-" + CatalogoDePrueba.unico(),
                categoriaId).replace("\"stockMinimo\":2", "\"stockMinimo\":" + minimo)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        Long id = json.readTree(respuesta).get("id").asLong();
        return catalogo.obtener(id);
    }

    private String bearerDe(Rol rol) {
        return usuarios.bearer(usuarios.crear(rol).id());
    }

    private MockHttpServletRequestBuilder comoAlmacen(MockHttpServletRequestBuilder peticion) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearerAlmacen).contentType(MediaType.APPLICATION_JSON);
    }

    private static String producto(String codigo, Long categoriaId) {
        return """
                {"codigo":"%s","nombre":"Filtro de aceite","marca":"Yamaha","categoriaId":%d,"unidad":"UNIDAD",
                 "precioVenta":16000,"stockMinimo":2}""".formatted(codigo, categoriaId);
    }
}
