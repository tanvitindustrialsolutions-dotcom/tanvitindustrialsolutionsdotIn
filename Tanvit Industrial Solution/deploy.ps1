param(
    [string]$OutputZip = "tanvit-hostinger-static.zip"
)

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$workspaceRoot = Split-Path -Parent $projectRoot
$stageDir = Join-Path $workspaceRoot "_deploy_stage"
$zipPath = if ([System.IO.Path]::IsPathRooted($OutputZip)) {
    $OutputZip
} else {
    Join-Path $workspaceRoot $OutputZip
}

$excludeDirs = @("node_modules", ".cursor", "server", "admin", "tools", "docs")
$excludeFiles = @(
    ".env.example",
    "package.json",
    "package-lock.json",
    "build-pages.cjs",
    "README.md",
    "deploy.ps1",
    "tanvit-hostinger-static.zip"
)

if (Test-Path $stageDir) {
    Remove-Item $stageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $stageDir | Out-Null

$robocopyArgs = @(
    "`"$projectRoot`"",
    "`"$stageDir`"",
    "/E"
)

if ($excludeDirs.Count -gt 0) {
    $robocopyArgs += "/XD"
    $robocopyArgs += $excludeDirs
}

if ($excludeFiles.Count -gt 0) {
    $robocopyArgs += "/XF"
    $robocopyArgs += $excludeFiles
}

robocopy @robocopyArgs | Out-Null

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -CompressionLevel Optimal -Force
Remove-Item $stageDir -Recurse -Force

$zipFile = Get-Item $zipPath
Write-Host "Deployment ZIP ready: $($zipFile.FullName)"
Write-Host "Size: $([math]::Round($zipFile.Length / 1MB, 2)) MB"
