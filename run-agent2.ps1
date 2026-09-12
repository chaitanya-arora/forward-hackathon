param(
    [string]$InputFile,
    [string]$OutputFile,
    [switch]$Test
)

$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $nodeExecutable = $nodeCommand.Source
} else {
    $nodeExecutable = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (!(Test-Path -LiteralPath $nodeExecutable)) {
        throw 'Node.js was not found. Install Node.js and reopen your terminal.'
    }
}

if ($Test) {
    & $nodeExecutable --test (Join-Path $PSScriptRoot 'src/agent2/tests/generateESGReport.test.js')
} else {
    if (!$InputFile) { $InputFile = Join-Path $PSScriptRoot 'src/agent2/examples/testEvidence.json' }
    if (!$OutputFile) { $OutputFile = Join-Path $PSScriptRoot 'src/agent2/output/esgReport.json' }
    & $nodeExecutable (Join-Path $PSScriptRoot 'src/agent2/generateESGReport.js') $InputFile $OutputFile
}
exit $LASTEXITCODE

