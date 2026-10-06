[CmdletBinding()]
param(
    [string]$Serial
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$apk = Join-Path $projectRoot 'dist\Codex-Meter.apk'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $apk)) { throw 'Build the APK first with scripts/build-apk.ps1.' }
if (-not (Test-Path -LiteralPath $adb)) { throw 'adb was not found.' }

if ([string]::IsNullOrWhiteSpace($Serial)) {
    $devices = @(& $adb devices | Select-Object -Skip 1 | ForEach-Object {
        if ($_ -match '^(\S+)\s+device$') { $Matches[1] }
    })
    if ($devices.Count -ne 1) {
        throw "Exactly one active ADB device is required; found: $($devices.Count)."
    }
    $Serial = $devices[0]
}

& $adb -s $Serial install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'Could not install the APK on the connected device.' }
