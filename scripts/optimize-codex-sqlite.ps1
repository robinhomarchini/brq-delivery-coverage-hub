param(
  [string]$CodexRoot = "$env:USERPROFILE\.codex",
  [string]$Python = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonScript = Join-Path $ScriptDir "optimize-codex-sqlite.py"
$LogFile = Join-Path $CodexRoot "sqlite-maintenance.log"
$DefaultPython = "$env:LOCALAPPDATA\Python\bin\python.exe"

if (-not $Python) {
  $Python = if (Test-Path -LiteralPath $DefaultPython) { $DefaultPython } else { "python" }
}

& $Python $PythonScript --codex-root $CodexRoot --log-file $LogFile --remove-maintenance-backups
