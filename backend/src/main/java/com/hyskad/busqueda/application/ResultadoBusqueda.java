package com.hyskad.busqueda.application;

import java.util.List;

/**
 * Resultados por tipo de la búsqueda global; cada lista vacía si no hubo coincidencias o el usuario
 * no puede ver ese tipo. {@code detalle} es una línea de contexto (documento, moto, estado...).
 */
public record ResultadoBusqueda(List<Item> clientes, List<Item> motocicletas, List<Item> ordenes,
        List<Item> productos, List<Item> ventas) {

    public static final ResultadoBusqueda VACIO = new ResultadoBusqueda(List.of(), List.of(), List.of(), List.of(),
            List.of());

    public record Item(Long id, String titulo, String detalle) {
    }
}
