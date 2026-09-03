$ErrorActionPreference = 'Stop'

function Remove-UserPathEntry([string]$directory) {
    if (-not $directory) { return $false }
    try { $normalized = [IO.Path]::GetFullPath($directory).TrimEnd('\') } catch { $normalized = $directory.TrimEnd('\') }
    $current = [Environment]::GetEnvironmentVariable('Path', 'User')
    $entries = @($current -split ';' | Where-Object { $_ })
    $kept = @($entries | Where-Object {
        try { [IO.Path]::GetFullPath($_).TrimEnd('\') -ne $normalized } catch { $_.TrimEnd('\') -ne $normalized }
    })
    [Environment]::SetEnvironmentVariable('Path', ($kept -join ';'), 'User')
    return $entries.Count - $kept.Count
}

$installedBin = [Environment]::GetEnvironmentVariable('CLI_TOOLKIT_FW_BIN', 'User')
$removedCount = Remove-UserPathEntry $installedBin
[Environment]::SetEnvironmentVariable('CLI_TOOLKIT_FW_HOME', $null, 'User')
[Environment]::SetEnvironmentVariable('CLI_TOOLKIT_FW_NAME', $null, 'User')
[Environment]::SetEnvironmentVariable('CLI_TOOLKIT_FW_BIN', $null, 'User')
$env:CLI_TOOLKIT_FW_HOME = $null
$env:CLI_TOOLKIT_FW_NAME = $null
$env:CLI_TOOLKIT_FW_BIN = $null

Write-Host 'cli-toolkit-fw environment registration was removed.' -ForegroundColor Green
Write-Host "Removed PATH entries: $removedCount"
Write-Host 'No project files, launchers, dependencies, configuration, or logs were deleted.'
Write-Host 'Open a new terminal for the environment changes to take effect.'
