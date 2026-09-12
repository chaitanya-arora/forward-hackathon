# Forward all arguments to the backend CLI; locate Node just as run-agent2 does.
$ErrorActionPreference = 'Stop'
$nodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
$nodeExecutable = if ($nodeCommand) { $nodeCommand.Source } else {
    Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (!(Test-Path -LiteralPath $nodeExecutable)) { throw 'Node.js was not found. Install Node.js and reopen your terminal.' }
& $nodeExecutable (Join-Path $PSScriptRoot 'src/pipeline/cli.js') @args
exit $LASTEXITCODE
