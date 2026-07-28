[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bridgeRoot = Join-Path $projectRoot 'bridge'
$configureLan = Join-Path $PSScriptRoot 'configure-lan.ps1'

Get-Command node.exe -ErrorAction Stop | Out-Null
Get-Command npm.cmd -ErrorAction Stop | Out-Null
Get-Command codex.exe -ErrorAction Stop | Out-Null

Push-Location -LiteralPath $bridgeRoot
try {
    & npm.cmd ci --omit=dev
    if ($LASTEXITCODE -ne 0) { throw 'Could not install the Windows controller.' }
} finally {
    Pop-Location
}

& (Join-Path $PSScriptRoot 'install-autostart.ps1')

$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$configuration = Start-Process `
    -FilePath $powerShell `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$configureLan`"") `
    -Verb RunAs `
    -WindowStyle Hidden `
    -Wait `
    -PassThru
if ($configuration.ExitCode -ne 0) {
    throw 'Could not configure the private LAN connection.'
}

Write-Output 'Codex Meter is installed. Its controller now runs silently.'
