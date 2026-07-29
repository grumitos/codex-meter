[CmdletBinding()]
param(
    [string]$Address,
    [switch]$RotateKey
)

$ErrorActionPreference = 'Stop'
$Port = 4317
$projectRoot = Split-Path -Parent $PSScriptRoot
$bridgeRoot = Join-Path $projectRoot 'bridge'
$dataDirectory = Join-Path $env:LOCALAPPDATA 'CodexMeter'
$pairingEndpoint = Join-Path $dataDirectory 'pairing-endpoint.json'
$pairingUrl = 'http://localhost:4318/'
$firewallRuleName = "Codex Meter LAN ($Port)"

function Test-PrivateIpv4 {
    param([Parameter(Mandatory)][string]$Value)

    $parsed = $null
    if (-not [System.Net.IPAddress]::TryParse($Value, [ref]$parsed)) { return $false }
    if ($parsed.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { return $false }
    $bytes = $parsed.GetAddressBytes()
    return (
        $bytes[0] -eq 10 -or
        ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
        ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
    )
}

$selectedAddress = $null
if (-not [string]::IsNullOrWhiteSpace($Address)) {
    if (-not (Test-PrivateIpv4 -Value $Address)) {
        throw 'Address debe ser una IPv4 privada (10/8, 172.16/12 o 192.168/16).'
    }
    $selectedAddress = Get-NetIPAddress -AddressFamily IPv4 -IPAddress $Address -ErrorAction Stop |
        Select-Object -First 1
} else {
    $routes = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' |
        Sort-Object RouteMetric
    foreach ($route in $routes) {
        $candidate = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -AddressState Preferred |
            Where-Object { -not $_.SkipAsSource -and (Test-PrivateIpv4 -Value $_.IPAddress) } |
            Select-Object -First 1
        if ($null -ne $candidate) {
            $selectedAddress = $candidate
            $Address = $candidate.IPAddress
            break
        }
    }
}

if ($null -eq $selectedAddress) {
    throw 'No se encontró una IPv4 privada con ruta predeterminada. Conecta el PC al Wi-Fi o usa -Address.'
}

$isAdministrator = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdministrator) {
    throw 'Ejecuta configure-lan.ps1 como administrador para limitar la regla de Firewall a la subred local.'
}

$profile = Get-NetConnectionProfile -InterfaceIndex $selectedAddress.InterfaceIndex -ErrorAction Stop
if ($profile.NetworkCategory -eq 'Public') {
    Set-NetConnectionProfile -InterfaceIndex $selectedAddress.InterfaceIndex -NetworkCategory Private
} elseif ($profile.NetworkCategory -ne 'Private') {
    throw "No se puede modificar el perfil de red '$($profile.Name)'."
}

$existingRule = Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
if ($null -eq $existingRule) {
    New-NetFirewallRule `
        -DisplayName $firewallRuleName `
        -Direction Inbound `
        -Action Allow `
        -Enabled True `
        -Profile Private `
        -Protocol TCP `
        -LocalPort $Port `
        -LocalAddress $Address `
        -RemoteAddress LocalSubnet | Out-Null
} else {
    $existingRule | Set-NetFirewallRule -Direction Inbound -Action Allow -Enabled True -Profile Private | Out-Null
    $existingRule | Get-NetFirewallPortFilter |
        Set-NetFirewallPortFilter -Protocol TCP -LocalPort $Port -RemotePort Any | Out-Null
    $existingRule | Get-NetFirewallAddressFilter |
        Set-NetFirewallAddressFilter -LocalAddress $Address -RemoteAddress LocalSubnet | Out-Null
}

$arguments = @(
    'scripts/create-pairing.mjs'
    '--host', $Address
    '--port', $Port.ToString([Globalization.CultureInfo]::InvariantCulture)
    '--output', $pairingEndpoint
    '--data-dir', $dataDirectory
)
if ($RotateKey) { $arguments += '--rotate' }

Push-Location -LiteralPath $bridgeRoot
try {
    & node.exe @arguments
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar el QR local.' }
} finally {
    Pop-Location
}

if ($RotateKey) {
    $task = Get-ScheduledTask -TaskName 'Codex Meter Bridge' -ErrorAction SilentlyContinue
    if ($null -ne $task) {
        Stop-ScheduledTask -TaskName $task.TaskName -ErrorAction SilentlyContinue
        Start-ScheduledTask -TaskName $task.TaskName
    } else {
        Write-Warning 'Reinicia Codex Meter para aplicar la clave rotada.'
    }
}

$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $pairingUrl -TimeoutSec 1
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 250
    }
}
if (-not $ready) {
    Stop-ScheduledTask -TaskName 'Codex Meter Bridge' -ErrorAction SilentlyContinue
    throw 'Codex Meter no pudo iniciar. El controlador se cerró sin dejar procesos abiertos.'
}

Start-Process -FilePath $pairingUrl
Write-Output "Emparejamiento abierto para https://${Address}:$Port en la red privada."
