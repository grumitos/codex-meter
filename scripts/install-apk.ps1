[CmdletBinding()]
param(
    [string]$Serial
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$apk = Join-Path $projectRoot 'dist\Codex-Meter.apk'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $apk)) { throw 'Primero compila el APK con scripts/build-apk.ps1.' }
if (-not (Test-Path -LiteralPath $adb)) { throw 'No se encontró adb.' }

if ([string]::IsNullOrWhiteSpace($Serial)) {
    $devices = @(& $adb devices | Select-Object -Skip 1 | ForEach-Object {
        if ($_ -match '^(\S+)\s+device$') { $Matches[1] }
    })
    if ($devices.Count -ne 1) {
        throw "Se necesita exactamente un dispositivo ADB activo; encontrados: $($devices.Count)."
    }
    $Serial = $devices[0]
}

& $adb -s $Serial install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar el APK en el dispositivo conectado.' }
