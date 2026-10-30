package com.hyskad.shared.web;

import java.util.List;
import java.util.function.Function;

import org.springframework.data.domain.Page;

/**
 * Respuesta paginada estándar de la API. El tamaño máximo de página (100) lo impone
 * {@code spring.data.web.pageable.max-page-size}.
 */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <T> PageResponse<T> of(Page<T> pagina) {
        return new PageResponse<>(pagina.getContent(), pagina.getNumber(), pagina.getSize(),
                pagina.getTotalElements(), pagina.getTotalPages());
    }

    public static <E, T> PageResponse<T> of(Page<E> pagina, Function<? super E, ? extends T> mapper) {
        return of(pagina.map(mapper));
    }
}
