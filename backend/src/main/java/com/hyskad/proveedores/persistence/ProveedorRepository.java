package com.hyskad.proveedores.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.hyskad.proveedores.domain.Proveedor;
import com.hyskad.shared.validation.TipoDocumento;

public interface ProveedorRepository extends JpaRepository<Proveedor, Long>, JpaSpecificationExecutor<Proveedor> {

    boolean existsByTipoDocumentoAndNumeroDocumento(TipoDocumento tipo, String numero);

    boolean existsByTipoDocumentoAndNumeroDocumentoAndIdNot(TipoDocumento tipo, String numero, Long id);
}
