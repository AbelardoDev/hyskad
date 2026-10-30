package com.hyskad.shared.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

class PageResponseTest {

    @Test
    void convierteUnaPaginaAplicandoElMapper() {
        PageImpl<Integer> pagina = new PageImpl<>(List.of(1, 2), PageRequest.of(1, 2), 5);

        PageResponse<String> respuesta = PageResponse.of(pagina, n -> "n" + n);

        assertThat(respuesta.content()).containsExactly("n1", "n2");
        assertThat(respuesta.page()).isEqualTo(1);
        assertThat(respuesta.size()).isEqualTo(2);
        assertThat(respuesta.totalElements()).isEqualTo(5);
        assertThat(respuesta.totalPages()).isEqualTo(3);
    }
}
