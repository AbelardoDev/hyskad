package com.hyskad.configuracion.application;

import org.springframework.stereotype.Component;

import com.hyskad.shared.correo.PieCorreo;

/** Pie de los correos con los datos del taller vigentes. */
@Component
class PieCorreoDelTaller implements PieCorreo {

    private final ConfiguracionService configuracion;

    PieCorreoDelTaller(ConfiguracionService configuracion) {
        this.configuracion = configuracion;
    }

    @Override
    public Datos datos() {
        DatosTaller t = configuracion.getDatosTaller();
        return new Datos(t.nombre(), t.nit(), t.direccion(), t.telefono());
    }
}
