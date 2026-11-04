param([string]$Tab = "", [string]$Out, [string]$Expr = "", [string]$File = "", [int]$W = 1280, [int]$H = 720, [int]$Quality = 82, [double]$Scale = 1, [int]$Port = 9335, [int]$Timeout = 60)
# Dev-only (not shipped). One screenshot of a headless Edge tab at W x H:
# optionally run an async JS body first (a file or an expression), then capture
# the page as a JPEG. Waits are bounded, as in cdp.ps1.
$ErrorActionPreference = "Stop"
if (-not $Tab) { $list = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json" -TimeoutSec 10; $Tab = ($list | Where-Object { $_.type -eq "page" } | Select-Object -First 1).id }
$ws = New-Object System.Net.WebSockets.ClientWebSocket
if (-not $ws.ConnectAsync([Uri]("ws://127.0.0.1:" + $Port + "/devtools/page/" + $Tab), [Threading.CancellationToken]::None).Wait(15000)) { "CONNECT TIMEOUT"; exit 1 }
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
  $buf = New-Object byte[] 4194304
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
    $o = ([Text.Encoding]::UTF8.GetString($ms.ToArray())) | ConvertFrom-Json
    if ($o.id -eq $wantId) { return $o }
  }
  return $null
}
$i = Send "Emulation.setDeviceMetricsOverride" @{ width = $W; height = $H; deviceScaleFactor = 1; mobile = $false }
$null = Recv $i 10
$body = ""
if ($File) { $body = [IO.File]::ReadAllText($File, [Text.Encoding]::UTF8) } elseif ($Expr) { $body = $Expr }
if ($body) {
  $wrapped = "(async () => { " + $body + "`n })().then((v) => JSON.stringify(v === undefined ? null : v), (e) => JSON.stringify({ __error: String(e && e.stack || e) }))"
  $i = Send "Runtime.evaluate" @{ expression = $wrapped; awaitPromise = $true; returnByValue = $true; timeout = ($Timeout * 1000) }
  $o = Recv $i ($Timeout + 5)
  if ($o -and $o.result.result.value) { $o.result.result.value }
}
$clip = @{ x = 0; y = 0; width = $W; height = $H; scale = $Scale }
$i = Send "Page.captureScreenshot" @{ format = "jpeg"; quality = $Quality; clip = $clip; captureBeyondViewport = $false }
$o = Recv $i 30
if ($o -and $o.result.data) { [IO.File]::WriteAllBytes($Out, [Convert]::FromBase64String($o.result.data)); "saved " + $Out } else { "no screenshot" }
$i = Send "Emulation.clearDeviceMetricsOverride" @{}; $null = Recv $i 5
try { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "", [Threading.CancellationToken]::None).Wait(2000) | Out-Null } catch {}
