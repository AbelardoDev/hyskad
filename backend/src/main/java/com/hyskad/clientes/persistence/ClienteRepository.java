package com.hyskad.clientes.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.hyskad.clientes.domain.Cliente;
import com.hyskad.shared.validation.TipoDocumento;

public interface ClienteRepository extends JpaRepository<Cliente, Long>, JpaSpecificationExecutor<Cliente> {

    boolean existsByTipoDocumentoAndNumeroDocumento(TipoDocumento tipo, String numero);

    boolean existsByTipoDocumentoAndNumeroDocumentoAndIdNot(TipoDocumento tipo, String numero, Long id);
}
