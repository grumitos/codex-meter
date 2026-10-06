[CmdletBinding()]
param(
    [string]$Serial
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$apk = Join-Path $projectRoot 'dist\Codex-Meter.apk'
if (-not (Test-Path -LiteralPath $apk)) { throw 'Build the APK first with scripts/build-apk.ps1.' }

# adb comes from the Android SDK: ANDROID_HOME, then ANDROID_SDK_ROOT, then the default install folder.
$adb = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    ForEach-Object { Join-Path $_ 'platform-tools\adb.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } |
    Select-Object -First 1
if (-not $adb) { throw 'adb was not found. Set ANDROID_HOME to the Android SDK folder.' }

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
