[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bridgeRoot = Join-Path $projectRoot 'bridge'
$build = Join-Path $bridgeRoot '.build'
$dist = Join-Path $projectRoot 'dist'
$bundle = Join-Path $build 'windows-app.cjs'
$icon = Join-Path $build 'codex-meter.ico'
$brandedRuntime = Join-Path $build 'Codex-Meter-Windows.runtime.exe'
$executable = Join-Path $dist 'Codex-Meter-Windows.exe'
$config = Join-Path $build 'sea-config.json'
$version = (Get-Content -Raw (Join-Path $bridgeRoot 'package.json') | ConvertFrom-Json).version
$node = (Get-Command node.exe -ErrorAction Stop).Source

New-Item -ItemType Directory -Path $build, $dist -Force | Out-Null

Push-Location -LiteralPath $bridgeRoot
try {
    & npx.cmd esbuild src/windows-app.mjs --bundle --platform=node --format=cjs --target=node26 --outfile=$bundle
    if ($LASTEXITCODE -ne 0) { throw 'Could not bundle the Windows controller.' }
    & node.exe scripts/create-windows-icon.mjs $icon
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the Windows icon.' }
} finally {
    Pop-Location
}

Push-Location -LiteralPath $bridgeRoot
try {
    & npx.cmd resedit --in $node --out $brandedRuntime `
        --ignore-signed `
        --icon "1,$icon" `
        --company-name 'Codex Meter' `
        --file-description 'Codex Meter private LAN controller' `
        --file-version "$version.0" `
        --internal-name 'Codex-Meter-Windows' `
        --original-filename 'Codex-Meter-Windows.exe' `
        --product-name 'Codex Meter' `
        --product-version "$version.0"
    if ($LASTEXITCODE -ne 0) { throw 'Could not brand the Windows executable.' }
} finally {
    Pop-Location
}

$seaConfiguration = @{
    main = $bundle
    mainFormat = 'commonjs'
    executable = $brandedRuntime
    output = $executable
    disableExperimentalSEAWarning = $true
    useSnapshot = $false
    useCodeCache = $false
    execArgvExtension = 'none'
} | ConvertTo-Json
[IO.File]::WriteAllText($config, $seaConfiguration, [Text.UTF8Encoding]::new($false))

& node.exe --build-sea=$config
if ($LASTEXITCODE -ne 0) { throw 'Could not build the Windows executable.' }

$bytes = [IO.File]::ReadAllBytes($executable)
$peHeader = [BitConverter]::ToInt32($bytes, 0x3c)
$subsystem = $peHeader + 24 + 68
[BitConverter]::GetBytes([uint16]2).CopyTo($bytes, $subsystem)
[IO.File]::WriteAllBytes($executable, $bytes)

Write-Output $executable
