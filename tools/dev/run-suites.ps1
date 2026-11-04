param([string]$Groups = "29", [string]$Out = "", [int]$Max = 3000, [string]$Port = "8080", [string]$Tab = "")
# Dev-only (not shipped). Test suites in headless Edge (tools/dev/edge-start.ps1,
# serve-lan.ps1 on :8080): -Groups "21,22;1,2,3" runs each group on a fresh page.
# A suite's result is one line, then its failures; -Out <folder> keeps each
# group's JSON. Batches of about seven suites take 25-30 minutes.
$s = $PSScriptRoot
$i = 0
foreach ($g in ($Groups -split ";")) {
  $i++
  $R = Get-Random -Minimum 1000 -Maximum 99999
  & powershell -ExecutionPolicy Bypass -File "$s\cdp.ps1" -Tab $Tab -Url "http://localhost:$Port/index.html?r=$R" -Timeout 20 | Out-Null
  & powershell -ExecutionPolicy Bypass -File "$s\cdp.ps1" -Tab $Tab -Timeout 80 -Expr "await new Promise(r => { const t0 = Date.now(); (function w(){ if ((window.G && G.MainMenu && G.MainMenu.visible()) || Date.now()-t0 > 75000) r(); else setTimeout(w, 300); })(); }); window.__suites = [$g]; return G.MainMenu.visible();" | Out-Null
  & powershell -ExecutionPolicy Bypass -File "$s\cdp.ps1" -Tab $Tab -Timeout 15 -File "$s\suites.js" | Out-Null
  $t0 = Get-Date; $res = $null
  do {
    Start-Sleep -Milliseconds 500
    $res = & powershell -ExecutionPolicy Bypass -File "$s\cdp.ps1" -Tab $Tab -Timeout 20 -Expr "return window._all;"
    if ($res -and $res -match '"running":false') { break }
  } while (((Get-Date) - $t0).TotalSeconds -lt $Max)
  if ($Out) { $res | Out-File -Encoding utf8 (Join-Path $Out "suites-$i.json") }
  try {
    $j = ($res | ConvertFrom-Json)
    foreach ($p in $j.res.PSObject.Properties) {
      $r = $p.Value
      if ($r.err) { "suite $($p.Name): ERR $($r.err)" }
      else {
        "suite $($p.Name): $($r.pass)/$($r.total)"
        $r.fails | ForEach-Object { if ($_ -is [string]) { "   FAIL $_" } else { "   FAIL $($_.name) :: $($_.info)" } }
      }
    }
  } catch { "group $i ($g): could not read the result" }
}
"all groups done"
