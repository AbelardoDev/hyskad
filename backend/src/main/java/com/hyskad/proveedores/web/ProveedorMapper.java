package com.hyskad.proveedores.web;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

import com.hyskad.proveedores.domain.Proveedor;
import com.hyskad.proveedores.web.dto.ProveedorResponse;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface ProveedorMapper {

    ProveedorResponse toResponse(Proveedor proveedor);
}
