[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$taskName = 'Codex Meter Bridge'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bridgeRoot = Join-Path $projectRoot 'bridge'
$server = Join-Path $bridgeRoot 'src\server.mjs'
$runner = Join-Path $PSScriptRoot 'run-hidden.vbs'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction `
    -Execute $wscript `
    -Argument "`"$runner`" `"$node`" `"$server`"" `
    -WorkingDirectory $bridgeRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -Hidden `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -ne $existingTask) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}

$task = @{
    TaskName = $taskName
    Action = $action
    Trigger = $trigger
    Principal = $principal
    Settings = $settings
    Description = 'Expone por HTTPS el uso semanal de Codex a Codex Meter en la red privada.'
    Force = $true
}
Register-ScheduledTask @task | Out-Null

Start-ScheduledTask -TaskName $taskName
$programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$shortcut = Join-Path $programs 'Codex Meter.url'
$shortcutContents = "[InternetShortcut]`r`nURL=http://localhost:4318/`r`n"
[System.IO.File]::WriteAllText(
    $shortcut,
    $shortcutContents,
    [System.Text.UTF8Encoding]::new($false)
)
Write-Output "Autoarranque instalado: $taskName"
Write-Output "Acceso instalado: $shortcut"
