# Dev-only (not shipped). The guns' balance, on paper: writes
# docs/expansion/balance-report.md, balance.csv and gun-changelog.md from the
# game's own data (tools/balance.js on tools/balance.html). Needs the server
# (serve-lan.ps1) and the headless Edge (tools/dev/edge-start.ps1, from a
# background job) up. A flag nobody explained shows at the end and exits 1.
param([string]$Port = "8080")
$root = Split-Path -Parent $PSScriptRoot
$R = Get-Random -Minimum 1000 -Maximum 99999
& powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\dev\cdp.ps1" -Url "http://localhost:$Port/tools/balance.html?r=$R" -Timeout 20 | Out-Null
Start-Sleep -Seconds 2
$raw = & powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\dev\cdp.ps1" -Timeout 60 -File "$PSScriptRoot\dev\balance-run.js"
$o = $null
try { $o = ($raw | ConvertFrom-Json) | ConvertFrom-Json } catch {}
# A page that was not ready answers null or an error: keep the old files.
if (-not $o -or -not $o.md) { "balance did not run (page not ready?): $raw"; exit 2 }
$enc = New-Object Text.UTF8Encoding($false)
$dir = Join-Path $root "docs\expansion"
[IO.File]::WriteAllText((Join-Path $dir "balance-report.md"), ($o.md -replace "`r`n", "`n"), $enc)
[IO.File]::WriteAllText((Join-Path $dir "balance.csv"), ($o.csv -replace "`r`n", "`n"), $enc)
[IO.File]::WriteAllText((Join-Path $dir "balance-melee.csv"), ($o.meleeCsv -replace "`r`n", "`n"), $enc)
[IO.File]::WriteAllText((Join-Path $dir "gun-changelog.md"), ($o.changelog -replace "`r`n", "`n"), $enc)
"written: balance-report.md, balance.csv, balance-melee.csv, gun-changelog.md; flags $($o.flags), not explained $(@($o.open).Count)"
$o.open | ForEach-Object { "  $_" }
if (@($o.open).Count) { exit 1 }
