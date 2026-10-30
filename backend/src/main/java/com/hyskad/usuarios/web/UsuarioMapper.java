package com.hyskad.usuarios.web;

import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;

import com.hyskad.usuarios.domain.Usuario;
import com.hyskad.usuarios.web.dto.UsuarioResponse;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface UsuarioMapper {

    UsuarioResponse toResponse(Usuario usuario);
}
