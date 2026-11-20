param(
    [string]$Python = 'python',
    [string]$Node = 'node',
    [string]$Data = $(if ($env:AGH_ATLAS_DATA_DIR) { $env:AGH_ATLAS_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'AgnesKnowledgeGraph' }),
    [switch]$SkipPython
)
$ErrorActionPreference = 'Stop'
$nodeExe = (Get-Command $Node -CommandType Application).Source
$npm = Join-Path (Split-Path $nodeExe) 'node_modules/npm/bin/npm-cli.js'
$quartz = Join-Path $Data 'quartz-4.2.4'
New-Item -ItemType Directory -Force $Data | Out-Null
if (-not (Test-Path -LiteralPath $quartz)) {
    $zip = Join-Path $Data 'quartz-v4.2.4.zip'
    Invoke-WebRequest -Uri 'https://codeload.github.com/jackyzha0/quartz/zip/refs/tags/v4.2.4' -OutFile $zip
    Expand-Archive -LiteralPath $zip -DestinationPath $Data
}

Push-Location $quartz
try {
    & $nodeExe $npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Quartz dependency install failed.' }
} finally {
    Pop-Location
}
& $nodeExe (Join-Path $PSScriptRoot 'build-client.mjs') $quartz
if ($LASTEXITCODE -ne 0) { throw 'Quartz browser build failed.' }

if (-not $SkipPython) {
    & $Python -m pip install --target (Join-Path $Data 'python') -r (Join-Path $PSScriptRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Document parser dependency install failed.' }
}
