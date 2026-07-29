[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bridgeRoot = Join-Path $projectRoot 'bridge'
$build = Join-Path $bridgeRoot '.build'
$dist = Join-Path $projectRoot 'dist'
$bundle = Join-Path $build 'windows-app.cjs'
$icon = Join-Path $build 'codex-meter.ico'
$trayWhite = Join-Path $build 'codex-meter-tray-white.ico'
$trayBlack = Join-Path $build 'codex-meter-tray-black.ico'
$executable = Join-Path $dist 'Codex-Meter-Windows.exe'
$launcher = Join-Path $bridgeRoot 'src\windows-launcher.cs'
$compiler = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $compiler) { throw '.NET Framework compiler not found.' }

New-Item -ItemType Directory -Path $build, $dist -Force | Out-Null

Push-Location -LiteralPath $bridgeRoot
try {
    & npx.cmd esbuild src/windows-app.mjs --bundle --minify --platform=node --format=cjs --target=node22 --outfile=$bundle
    if ($LASTEXITCODE -ne 0) { throw 'Could not bundle the Windows controller.' }
    & node.exe scripts/create-windows-icon.mjs $icon $trayWhite $trayBlack
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the Windows icon.' }
} finally {
    Pop-Location
}

& $compiler /nologo /target:winexe /optimize+ /platform:anycpu `
    "/win32icon:$icon" `
    "/resource:$bundle,CodexMeter.Controller" `
    "/resource:$trayWhite,CodexMeter.TrayWhite" `
    "/resource:$trayBlack,CodexMeter.TrayBlack" `
    "/out:$executable" `
    /reference:System.Core.dll `
    /reference:System.Drawing.dll `
    /reference:System.Windows.Forms.dll `
    $launcher
if ($LASTEXITCODE -ne 0) { throw 'Could not build the Windows launcher.' }

Write-Output $executable
