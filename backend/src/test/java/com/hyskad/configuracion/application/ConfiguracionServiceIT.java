package com.hyskad.configuracion.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.validation.DocumentoValidoValidator;
import com.hyskad.shared.validation.TipoDocumento;
import com.hyskad.support.IntegrationTest;

@IntegrationTest
class ConfiguracionServiceIT {

    @Autowired
    private ConfiguracionService service;

    @AfterEach
    void restaurarIva() {
        service.actualizar(ConfiguracionService.IVA_PORCENTAJE, "19");
    }

    @Test
    void leeLosValoresInicialesDeLaMigracion() {
        DatosTaller taller = service.getDatosTaller();

        assertThat(service.getIvaPorcentaje()).isEqualByComparingTo("19");
        assertThat(service.isAlertaStockHabilitada()).isTrue();
        assertThat(taller.nombre()).isEqualTo("Taller HYSKAD");
        assertThat(DocumentoValidoValidator.esValido(TipoDocumento.NIT, taller.nit())).isTrue();
    }

    @Test
    void actualizarInvalidaLaCache() {
        assertThat(service.getIvaPorcentaje()).isEqualByComparingTo("19");

        service.actualizar(ConfiguracionService.IVA_PORCENTAJE, "5");

        assertThat(service.getIvaPorcentaje()).isEqualByComparingTo(new BigDecimal("5"));
    }

    @Test
    void claveInexistente() {
        assertThatThrownBy(() -> service.valor("no.existe")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.actualizar("no.existe", "x")).isInstanceOf(NotFoundException.class);
    }
}
