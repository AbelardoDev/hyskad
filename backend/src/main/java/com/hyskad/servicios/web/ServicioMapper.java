package com.hyskad.servicios.web;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

import com.hyskad.servicios.domain.Servicio;
import com.hyskad.servicios.web.dto.ServicioResponse;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface ServicioMapper {

    ServicioResponse toResponse(Servicio servicio);
}
