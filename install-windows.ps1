$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bootstrapPath = Join-Path $projectDir 'cli-toolkit-fw.cmd'

function Add-UserPathEntry([string]$directory) {
    $normalized = [IO.Path]::GetFullPath($directory).TrimEnd('\')
    $current = [Environment]::GetEnvironmentVariable('Path', 'User')
    $entries = @($current -split ';' | Where-Object { $_ })
    $exists = $entries | Where-Object {
        try { [IO.Path]::GetFullPath($_).TrimEnd('\') -eq $normalized } catch { $_ -eq $directory }
    }
    if (-not $exists) {
        [Environment]::SetEnvironmentVariable('Path', ((@($entries) + $normalized) -join ';'), 'User')
        return $true
    }
    return $false
}

function Remove-UserPathEntry([string]$directory) {
    if (-not $directory) { return $false }
    try { $normalized = [IO.Path]::GetFullPath($directory).TrimEnd('\') } catch { $normalized = $directory.TrimEnd('\') }
    $current = [Environment]::GetEnvironmentVariable('Path', 'User')
    $entries = @($current -split ';' | Where-Object { $_ })
    $kept = @($entries | Where-Object {
        try { [IO.Path]::GetFullPath($_).TrimEnd('\') -ne $normalized } catch { $_.TrimEnd('\') -ne $normalized }
    })
    if ($kept.Count -ne $entries.Count) {
        [Environment]::SetEnvironmentVariable('Path', ($kept -join ';'), 'User')
        return $true
    }
    return $false
}

function Wait-ForExitKey {
    Write-Host ''
    Write-Host 'Press any key to exit...'
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        [void][Console]::ReadKey($true)
    }
}

if (-not (Test-Path -LiteralPath $bootstrapPath -PathType Leaf)) {
    throw "Framework launcher not found: $bootstrapPath"
}

$customName = Read-Host 'Command and UI name [toolkit]'
if ([string]::IsNullOrWhiteSpace($customName)) { $customName = 'toolkit' }
$customName = $customName.Trim()
if ($customName.Length -gt 40 -or $customName -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') {
    throw 'Name must be 1-40 characters, start with a letter or number, and contain only letters, numbers, dot, underscore, or hyphen.'
}

$bunCommand = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bunCommand) {
    Write-Host 'Bun is not installed. Installing Bun...'
    $installerPath = Join-Path ([IO.Path]::GetTempPath()) "cli-toolkit-fw-bun-$([Guid]::NewGuid()).ps1"
    try {
        Invoke-WebRequest -UseBasicParsing -Uri 'https://bun.sh/install.ps1' -OutFile $installerPath
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerPath
        if ($LASTEXITCODE -ne 0) { throw 'Bun installation failed.' }
    } finally {
        if (Test-Path -LiteralPath $installerPath) { [IO.File]::Delete($installerPath) }
    }
    $bunDirectory = Join-Path $env:USERPROFILE '.bun\bin'
    $env:Path = "$bunDirectory;$env:Path"
    [void](Add-UserPathEntry $bunDirectory)
    $bunCommand = Get-Command bun -ErrorAction SilentlyContinue
}

if (-not $bunCommand) {
    throw 'Bun was installed but is not available. Open a new terminal and run this installer again.'
}

Push-Location $projectDir
try {
    Write-Host 'Installing dependencies...'
    & $bunCommand.Source install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    Write-Host 'Validating project...'
    & $bunCommand.Source run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Project validation failed.' }
    & $bunCommand.Source test
    if ($LASTEXITCODE -ne 0) { throw 'Project tests failed.' }
} finally {
    Pop-Location
}

$launcherDir = Join-Path $projectDir ".cli-toolkit-fw\launchers\$customName"
$customLauncher = Join-Path $launcherDir "$customName.cmd"
[void](New-Item -ItemType Directory -Force -Path $launcherDir)
$launcherContent = "@echo off`r`nset `"CLI_TOOLKIT_FW_NAME=$customName`"`r`ncall `"$bootstrapPath`" %*`r`nexit /b %ERRORLEVEL%`r`n"
[IO.File]::WriteAllText($customLauncher, $launcherContent, [Text.UTF8Encoding]::new($false))

$previousBin = [Environment]::GetEnvironmentVariable('CLI_TOOLKIT_FW_BIN', 'User')
$oldPathRemoved = $false
if ($previousBin -and $previousBin -ne $launcherDir) {
    $oldPathRemoved = Remove-UserPathEntry $previousBin
}

[Environment]::SetEnvironmentVariable('CLI_TOOLKIT_FW_HOME', $projectDir, 'User')
[Environment]::SetEnvironmentVariable('CLI_TOOLKIT_FW_NAME', $customName, 'User')
[Environment]::SetEnvironmentVariable('CLI_TOOLKIT_FW_BIN', $launcherDir, 'User')
$env:CLI_TOOLKIT_FW_HOME = $projectDir
$env:CLI_TOOLKIT_FW_NAME = $customName
$env:CLI_TOOLKIT_FW_BIN = $launcherDir

$pathChanged = Add-UserPathEntry $launcherDir
$env:Path = "$launcherDir;$env:Path"

Write-Host ''
Write-Host "$customName installed successfully." -ForegroundColor Green
Write-Host "Command: $customName"
Write-Host "UI name: $customName"
Write-Host "Install directory: $projectDir"
Write-Host "Log file: $(Join-Path $env:LOCALAPPDATA 'cli-toolkit-fw\logs\cli-toolkit-fw.log')"
if ($oldPathRemoved) { Write-Host "Removed previous PATH entry: $previousBin" }
if ($pathChanged) {
    Write-Host "PATH was updated. Open a new terminal before running: $customName"
} else {
    Write-Host "PATH is already configured. Run: $customName"
}

Wait-ForExitKey
