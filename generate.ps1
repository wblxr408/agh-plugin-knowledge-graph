param(
    [Parameter(Mandatory)][string]$Source,
    [string]$Python = 'python',
    [string]$Node = 'node',
    [string]$Data = $(if ($env:AGH_ATLAS_DATA_DIR) { $env:AGH_ATLAS_DATA_DIR } else { Join-Path $env:LOCALAPPDATA 'AgnesKnowledgeGraph' })
)
$ErrorActionPreference = 'Stop'
$Source = (Resolve-Path -LiteralPath $Source).Path
$Data = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Data)
$env:PYTHONUTF8 = '1'
$env:PYTHONPATH = if ($env:PYTHONPATH) { "$(Join-Path $Data 'python');$env:PYTHONPATH" } else { Join-Path $Data 'python' }
$quartz = Join-Path $Data 'quartz-4.2.4'
$run = Join-Path $Data ('build-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $run | Out-Null
$guard = [IO.File]::Open((Join-Path $Data 'generate.lock'), 'OpenOrCreate', 'ReadWrite', 'None')

try {
    Push-Location $quartz
    try {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'quartz.config.ts') -Destination (Join-Path $quartz 'quartz.config.ts') -Force
        & $Python (Join-Path $PSScriptRoot 'stage.py') $Source $run
        if ($LASTEXITCODE -ne 0) { throw '资料整理失败。' }
        & $Node 'quartz/bootstrap-cli.mjs' build --directory (Join-Path $run 'vault') --output (Join-Path $run 'out') --concurrency 3
        if ($LASTEXITCODE -ne 0) { throw 'Quartz 生成失败。' }
        & $Node (Join-Path $PSScriptRoot 'publish.mjs') $run $Data
        if ($LASTEXITCODE -ne 0) { throw '图谱保存失败。' }
    } finally {
        Pop-Location
    }
} finally {
    $guard.Dispose()
}
