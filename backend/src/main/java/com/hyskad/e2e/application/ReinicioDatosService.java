package com.hyskad.e2e.application;

import org.flywaydb.core.Flyway;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

/**
 * Deja la BD como recién instalada con los datos semilla (TEST-PLAN §4). Borra el esquema y vuelve a
 * aplicar las migraciones, incluidas las de {@code db/dev-data}. Existe solo en el perfil {@code e2e}.
 */
@Service
@Profile("e2e")
public class ReinicioDatosService {

    private final Flyway flyway;

    public ReinicioDatosService(Flyway flyway) {
        this.flyway = flyway;
    }

    public void reiniciar() {
        flyway.clean();
        flyway.migrate();
    }
}
