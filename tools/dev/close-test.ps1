param([int]$Port = 9335, [string]$Site = "http://localhost:8080/index.html")
# Dev-only (not shipped). The expansion's round 1: the tab goes away while the
# save is being written, in a real page (tools/dev/edge-start.ps1, serve-lan.ps1).
#   crash    the renderer dies right after G.persist(true), IndexedDB mid-write
#   close    the tab is closed right after G.persist() (the two-second wait not
#            over): its own pagehide has to write it
#   reload   the same, by reloading
# Each sets a number no earlier run has, then a new page has to show it. Prints
# one line a case; the profile's endlessHighScore is put back at the end.
$s = $PSScriptRoot
function Cdp([string[]]$extra) { & powershell -NoProfile -ExecutionPolicy Bypass -File "$s\cdp.ps1" -Port $Port @extra }
$waitMenu = "await new Promise((r) => { const t0 = Date.now(); (function w() { if ((window.G && G.MainMenu && G.MainMenu.visible()) || Date.now() - t0 > 170000) r(); else setTimeout(w, 300); })(); }); return { menu: !!(window.G && G.MainMenu && G.MainMenu.visible()), n: window.G && G.save && G.save.endlessHighScore, rev: window.G && G.save && G.save.meta.rev, fail: !!(window.G && G.SaveManager.failure()) };"
function NewTab { (Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:$Port/json/new?about:blank" -TimeoutSec 10).id }
function Pages { $l = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 10; @($l | ForEach-Object { $_ } | Where-Object { $_.type -eq "page" }) }

$tab = NewTab
$first = Cdp @("-Tab", $tab, "-Url", "$Site`?r=$(Get-Random)", "-Expr", $waitMenu, "-Timeout", "200") | Select-Object -Last 1
"start: $first"
$keep = ($first | ConvertFrom-Json).n
$fail = 0
$cases = @(
  @{ name = "crash"; set = "G.save.endlessHighScore = {N}; G.persist(true); return 1;"; how = "-Crash" },
  @{ name = "close"; set = "G.save.endlessHighScore = {N}; G.persist(); return 1;"; how = "-Close" },
  @{ name = "reload"; set = "G.save.endlessHighScore = {N}; G.persist(); location.reload(); return 1;"; how = "" }
)
foreach ($c in $cases) {
  $n = Get-Random -Minimum 100000 -Maximum 999999
  $body = $c.set.Replace("{N}", "$n")
  if ($c.how) { Cdp @("-Tab", $tab, $c.how, "-Expr", $body, "-Timeout", "10") | Out-Null } else { Cdp @("-Tab", $tab, "-Expr", $body, "-Timeout", "10") | Out-Null }
  Start-Sleep -Seconds 2
  # (a crashed or closed tab: a new one)
  if ($c.how) { try { Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/close/$tab" -TimeoutSec 5 | Out-Null } catch {}; $tab = NewTab }
  $res = Cdp @("-Tab", $tab, "-Url", "$Site`?r=$(Get-Random)", "-Expr", $waitMenu, "-Timeout", "200") | Select-Object -Last 1
  $j = $res | ConvertFrom-Json
  $good = $j.menu -and ($j.n -eq $n) -and -not $j.fail
  if (-not $good) { $fail++ }
  "{0,-7} {1}  wanted {2}, got {3}, rev {4}" -f $c.name, $(if ($good) { "ok" } else { "FAIL" }), $n, $j.n, $j.rev
}
Cdp @("-Tab", $tab, "-Expr", "G.save.endlessHighScore = $keep; G.persist(true); await G.SaveManager.settled(); return 1;", "-Timeout", "15") | Out-Null
Cdp @("-Tab", $tab, "-Url", "about:blank") | Out-Null
"failed: $fail"
