# Cuenta las sentencias SQL de cada operación habitual y de cada reporte (búsqueda de N+1, F12).
# Requisitos: backend con el perfil perf y --logging.level.org.hibernate.SQL=debug, con su salida en
# el archivo que se pasa como -Log. Cada petición lleva su propio X-Request-Id, que el backend pone en
# cada línea del log; así se cuentan las sentencias de esa petición.
#   pwsh infra/k6/contar-consultas.ps1 -Log backend-perf-sql.log
param(
    [Parameter(Mandatory)] [string] $Log,
    [string] $Base = 'http://localhost:8082/api/v1'
)

$login = Invoke-RestMethod -Method Post -Uri "$Base/auth/login" -ContentType 'application/json' `
    -Body '{"email":"admin@hyskad.local","password":"Hyskad2026"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }
$id = (Invoke-RestMethod -Uri "$Base/ordenes-trabajo?estado=EN_DIAGNOSTICO&size=1" -Headers $h).content[0].id
$version = (Invoke-RestMethod -Uri "$Base/ordenes-trabajo/$id" -Headers $h).version
$producto = (Invoke-RestMethod -Uri "$Base/productos?q=PERF&size=1" -Headers $h).content[0].id
$desde = (Get-Date).AddDays(-364).ToString('yyyy-MM-dd')
$hasta = (Get-Date).ToString('yyyy-MM-dd')
$sufijo = Get-Random

$operaciones = [ordered]@{
    'listar-ordenes'     = @('GET', '/ordenes-trabajo?page=0&size=20&sort=fechaIngreso,desc', $null)
    'buscar-ordenes'     = @('GET', '/ordenes-trabajo?q=XYA1&size=20', $null)
    'detalle-orden'      = @('GET', "/ordenes-trabajo/$id", $null)
    'agregar-repuesto'   = @('POST', "/ordenes-trabajo/$id/repuestos", "{`"version`":$version,`"productoId`":$producto,`"cantidad`":1}")
    'crear-venta'        = @('POST', '/ventas', "{`"items`":[{`"productoId`":$producto,`"cantidad`":1}],`"descuento`":0,`"metodoPago`":`"EFECTIVO`",`"montoRecibido`":1000000}")
    'reporte-servicios'  = @('GET', "/reportes/servicios?desde=$desde&hasta=$hasta", $null)
    'reporte-inventario' = @('GET', "/reportes/inventario?desde=$desde&hasta=$hasta", $null)
    'reporte-ventas'     = @('GET', "/reportes/ventas?desde=$desde&hasta=$hasta", $null)
    'cuentas-pendientes' = @('GET', '/reportes/cuentas-pendientes?size=20', $null)
    'dashboard'          = @('GET', '/dashboard', $null)
    'busqueda-global'    = @('GET', '/busqueda?q=XYA1', $null)
}

foreach ($nombre in $operaciones.Keys) {
    $metodo, $ruta, $cuerpo = $operaciones[$nombre]
    $cabeceras = $h.Clone()
    $cabeceras['X-Request-Id'] = "n1-$nombre-$sufijo"
    $args = @{ UseBasicParsing = $true; Method = $metodo; Uri = "$Base$ruta"; Headers = $cabeceras }
    if ($cuerpo) { $args['ContentType'] = 'application/json'; $args['Body'] = $cuerpo }
    Invoke-WebRequest @args | Out-Null
}
Start-Sleep -Seconds 2

foreach ($nombre in $operaciones.Keys) {
    $n = (Select-String -Path $Log -SimpleMatch "[n1-$nombre-$sufijo]" | Select-String -SimpleMatch 'org.hibernate.SQL').Count
    '{0,-20} {1,4} sentencias SQL' -f $nombre, $n
}
