package com.hyskad.support;

import java.math.BigDecimal;
import java.util.UUID;

import org.springframework.boot.test.context.TestComponent;

import com.hyskad.catalogo.application.CategoriaService;
import com.hyskad.catalogo.application.GuardarCategoria;
import com.hyskad.catalogo.application.GuardarProducto;
import com.hyskad.catalogo.application.ProductoService;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.catalogo.domain.Unidad;

/** Crea categorías y productos con códigos únicos (las pruebas de integración comparten la BD). */
@TestComponent
public class CatalogoDePrueba {

    private final CategoriaService categorias;
    private final ProductoService productos;

    public CatalogoDePrueba(CategoriaService categorias, ProductoService productos) {
        this.categorias = categorias;
        this.productos = productos;
    }

    public Long categoria() {
        return categorias.crear(new GuardarCategoria("Cat " + unico(), null)).getId();
    }

    /** Producto activo sin existencias, con el stock mínimo indicado. */
    public Producto producto(String stockMinimo) {
        return productos.crear(new GuardarProducto("P-" + unico(), "Producto de prueba", null, "Marca", categoria(),
                Unidad.UNIDAD, new BigDecimal("25000"), new BigDecimal(stockMinimo)));
    }

    public Producto obtener(Long id) {
        return productos.obtener(id);
    }

    public static String unico() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
