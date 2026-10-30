package com.hyskad.e2e.application;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class ReinicioDatosServiceTest {

    @Test
    void borraElEsquemaYVuelveAAplicarLasMigracionesConLosDatosSemilla() {
        Flyway flyway = mock(Flyway.class);

        new ReinicioDatosService(flyway).reiniciar();

        InOrder orden = inOrder(flyway);
        orden.verify(flyway).clean();
        orden.verify(flyway).migrate();
    }
}
