[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'

Push-Location -LiteralPath $androidRoot
try {
    # Gradle picks the JDK from JAVA_HOME or the PATH, and the SDK from ANDROID_HOME or local.properties.
    & .\gradlew.bat testDebugUnitTest lintDebug assembleDebug --no-parallel --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'The Android build failed.' }
} finally {
    Pop-Location
}

$dist = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$sourceApk = Join-Path $androidRoot 'app\build\outputs\apk\debug\app-debug.apk'
$targetApk = Join-Path $dist 'Codex-Meter.apk'
Copy-Item -LiteralPath $sourceApk -Destination $targetApk -Force
Write-Output $targetApk
