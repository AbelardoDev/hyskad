package com.hyskad.catalogo.web;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

import com.hyskad.catalogo.domain.Categoria;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.catalogo.web.dto.CategoriaResponse;
import com.hyskad.catalogo.web.dto.ProductoResponse;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface CatalogoMapper {

    CategoriaResponse toResponse(Categoria categoria);

    ProductoResponse toResponse(Producto producto);

    ProductoResponse.CategoriaResumen toResumen(Categoria categoria);
}
