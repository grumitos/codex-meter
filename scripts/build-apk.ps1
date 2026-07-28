[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'

$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Push-Location -LiteralPath $androidRoot
try {
    & .\gradlew.bat testDebugUnitTest lintDebug assembleDebug --no-parallel --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'La compilación Android falló.' }
} finally {
    Pop-Location
}

$dist = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$sourceApk = Join-Path $androidRoot 'app\build\outputs\apk\debug\app-debug.apk'
$targetApk = Join-Path $dist 'Codex-Meter.apk'
Copy-Item -LiteralPath $sourceApk -Destination $targetApk -Force
Write-Output $targetApk
