package com.hyskad.clientes.web;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

import com.hyskad.clientes.domain.Cliente;
import com.hyskad.clientes.web.dto.ClienteResponse;
import com.hyskad.clientes.web.dto.ClienteResumenResponse;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface ClienteMapper {

    ClienteResponse toResponse(Cliente cliente);

    ClienteResumenResponse toResumen(Cliente cliente);
}
