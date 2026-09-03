$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

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

function Wait-ForExitKey {
    Write-Host ''
    Write-Host 'Press any key to exit...'
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        [void][Console]::ReadKey($true)
    }
}

$installedBin = [Environment]::GetEnvironmentVariable('CLI_TOOLKIT_FW_BIN', 'User')
$removedCount = Remove-UserPathEntry $installedBin
[Environment]::SetEnvironmentVariable('CLI_TOOLKIT_FW_HOME', $null, 'User')
[Environment]::SetEnvironmentVariable('CLI_TOOLKIT_FW_NAME', $null, 'User')
[Environment]::SetEnvironmentVariable('CLI_TOOLKIT_FW_BIN', $null, 'User')
$env:CLI_TOOLKIT_FW_HOME = $null
$env:CLI_TOOLKIT_FW_NAME = $null
$env:CLI_TOOLKIT_FW_BIN = $null

$generatedDirectory = [IO.Path]::GetFullPath((Join-Path $projectDir '.cli-toolkit-fw'))
$dependenciesDirectory = [IO.Path]::GetFullPath((Join-Path $projectDir 'node_modules'))
$projectDirectory = [IO.Path]::GetFullPath($projectDir).TrimEnd('\')
$expectedPrefix = "$projectDirectory\"
$generatedRemoved = $false
if (
    $generatedDirectory.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase) -and
    [IO.Path]::GetFileName($generatedDirectory) -eq '.cli-toolkit-fw' -and
    (Test-Path -LiteralPath $generatedDirectory -PathType Container)
) {
    Remove-Item -LiteralPath $generatedDirectory -Recurse -Force
    $generatedRemoved = $true
}

$dependenciesRemoved = $false
if (
    $dependenciesDirectory.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase) -and
    [IO.Path]::GetFileName($dependenciesDirectory) -eq 'node_modules' -and
    (Test-Path -LiteralPath $dependenciesDirectory -PathType Container)
) {
    Remove-Item -LiteralPath $dependenciesDirectory -Recurse -Force
    $dependenciesRemoved = $true
}

Write-Host 'cli-toolkit-fw environment registration was removed.' -ForegroundColor Green
Write-Host "Removed PATH entries: $removedCount"
Write-Host "Generated launcher directory removed: $generatedRemoved"
Write-Host "Dependency directory removed: $dependenciesRemoved"
Write-Host 'Bun, source code, extensions, configuration, and logs were kept.'
Write-Host 'Open a new terminal for the environment changes to take effect.'

Wait-ForExitKey
