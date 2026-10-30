package com.hyskad.motocicletas.web;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

import com.hyskad.clientes.domain.Cliente;
import com.hyskad.motocicletas.domain.Motocicleta;
import com.hyskad.motocicletas.web.dto.MotocicletaResponse;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface MotocicletaMapper {

    @Mapping(target = "propietario", source = "cliente")
    MotocicletaResponse toResponse(Motocicleta moto);

    MotocicletaResponse.Propietario toPropietario(Cliente cliente);
}
