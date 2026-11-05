param([string]$Tab = "", [string]$Url = "", [string]$File = "", [string]$Expr = "", [int]$Timeout = 60, [int]$W = 0, [int]$H = 0, [int]$Port = 9335, [string]$Init = "", [switch]$Crash, [switch]$Close)
# Dev-only (not shipped). Drive one headless Edge tab over the DevTools protocol
# (tools/dev/edge-start.ps1): optionally load a page, optionally set the
# viewport, then run an async JS body (a file or an expression; `return x` gives
# the result) and print its value. -Tab: a page id; left out, the first page.
# -Init: a script to run before the page's own on the -Url load (a seeded
# Math.random, say). -Crash / -Close: the renderer killed, or the tab closed,
# right behind the JS body, without waiting for it (tools/dev/close-test.ps1).
# Every wait is bounded: a stuck connection once span a core
# for an hour and stalled the run behind it.
$ErrorActionPreference = "Stop"
if (-not $Tab) { $list = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 10; $Tab = ($list | Where-Object { $_.type -eq "page" } | Select-Object -First 1).id }
if (-not $Tab) { "NO PAGE"; exit 1 }
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ws.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(20)
$uri = [Uri]("ws://127.0.0.1:" + $Port + "/devtools/page/" + $Tab)
if (-not $ws.ConnectAsync($uri, [Threading.CancellationToken]::None).Wait(15000)) { "CONNECT TIMEOUT"; exit 1 }
$script:nextId = 0
function Send($method, $params) {
  $script:nextId++
  $msg = @{ id = $script:nextId; method = $method; params = $params } | ConvertTo-Json -Depth 20 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
  if (-not $ws.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait(15000)) { "SEND TIMEOUT"; exit 1 }
  return $script:nextId
}
function Recv($wantId, $secs) {
  $deadline = (Get-Date).AddSeconds($secs)
  $buf = New-Object byte[] 1048576
  while ((Get-Date) -lt $deadline) {
    $ms = New-Object IO.MemoryStream
    do {
      if ((Get-Date) -ge $deadline -or $ws.State -ne [System.Net.WebSockets.WebSocketState]::Open) { return $null }
      $cts = New-Object Threading.CancellationTokenSource
      $cts.CancelAfter([Math]::Max(1000, [int](($deadline - (Get-Date)).TotalMilliseconds)))
      try { $r = $ws.ReceiveAsync([ArraySegment[byte]]::new($buf), $cts.Token).Result } catch { return $null }
      if ($r.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { return $null }
      $ms.Write($buf, 0, $r.Count)
    } while (-not $r.EndOfMessage)
    $txt = [Text.Encoding]::UTF8.GetString($ms.ToArray())
    $o = $txt | ConvertFrom-Json
    if ($o.id -eq $wantId) { return $o }
  }
  return $null
}
if ($Url) {
  if ($Init) { $i = Send "Page.addScriptToEvaluateOnNewDocument" @{ source = $Init }; $null = Recv $i 10 }
  $i = Send "Page.navigate" @{ url = $Url }
  $null = Recv $i 30
  Start-Sleep -Milliseconds 800
}
if ($W -gt 0 -and $H -gt 0) {
  $i = Send "Emulation.setDeviceMetricsOverride" @{ width = $W; height = $H; deviceScaleFactor = 1; mobile = $false }
  $null = Recv $i 10
}
$body = ""
if ($File) { $body = [IO.File]::ReadAllText($File, [Text.Encoding]::UTF8) } elseif ($Expr) { $body = $Expr }
if ($body) {
  $wrapped = "(async () => { " + $body + "`n })().then((v) => JSON.stringify(v === undefined ? null : v), (e) => JSON.stringify({ __error: String(e && e.stack || e) }))"
  $i = Send "Runtime.evaluate" @{ expression = $wrapped; awaitPromise = $true; returnByValue = $true; timeout = ($Timeout * 1000) }
  if ($Crash) { $null = Send "Page.crash" @{}; Start-Sleep -Milliseconds 300; exit 0 }
  if ($Close) { $null = Send "Page.close" @{}; Start-Sleep -Milliseconds 300; exit 0 }
  $o = Recv $i ($Timeout + 5)
  if ($null -eq $o) { "TIMEOUT after $Timeout s" }
  elseif ($o.result.exceptionDetails) { "EXCEPTION: " + ($o.result.exceptionDetails | ConvertTo-Json -Depth 6 -Compress) }
  else { $o.result.result.value }
}
if ($W -gt 0 -and $H -gt 0) { $i = Send "Emulation.clearDeviceMetricsOverride" @{}; $null = Recv $i 5 }
try { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "", [Threading.CancellationToken]::None).Wait(2000) | Out-Null } catch {}
