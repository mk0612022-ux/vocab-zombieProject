# Static file server reachable from other devices on the same Wi-Fi
# (phone / iPad), unlike serve.ps1 which only listens on localhost.
#
# Uses a raw TcpListener rather than HttpListener on purpose: binding
# HttpListener to all interfaces ("http://+:8080/") needs an admin-registered
# urlacl, while a TcpListener on 0.0.0.0 needs no special rights at all.
param([int]$Port = 8080)

$root = $PSScriptRoot
$mime = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"; ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"
  ".gif" = "image/gif"; ".svg" = "image/svg+xml"; ".ico" = "image/x-icon"
  ".txt" = "text/plain; charset=utf-8"; ".csv" = "text/csv; charset=utf-8"
  ".woff" = "font/woff"; ".woff2" = "font/woff2"
}

$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -ExpandProperty IPAddress

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()
Write-Host "Serving $root"
Write-Host "  local:   http://localhost:$Port/"
foreach ($ip in $ips) { Write-Host "  network: http://${ip}:$Port/" }

function Send-Response {
  param($stream, [int]$status, [string]$statusText, [string]$contentType, [byte[]]$body, [bool]$headOnly)
  $head = "HTTP/1.1 $status $statusText`r`n" +
          "Content-Type: $contentType`r`n" +
          "Content-Length: $($body.Length)`r`n" +
          "Cache-Control: no-store, no-cache, must-revalidate`r`n" +
          "Access-Control-Allow-Origin: *`r`n" +
          "Connection: close`r`n`r`n"
  $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($headBytes, 0, $headBytes.Length)
  if (-not $headOnly -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

while ($listener.Pending() -or $true) {
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 5000
    $client.SendTimeout = 15000
    $stream = $client.GetStream()

    # read the request head (everything up to the blank line)
    $buf = New-Object byte[] 8192
    $sb = New-Object System.Text.StringBuilder
    $headerEnd = -1
    while ($headerEnd -lt 0) {
      $n = $stream.Read($buf, 0, $buf.Length)
      if ($n -le 0) { break }
      [void]$sb.Append([System.Text.Encoding]::ASCII.GetString($buf, 0, $n))
      $headerEnd = $sb.ToString().IndexOf("`r`n`r`n")
    }
    $raw = $sb.ToString()
    if (-not $raw) { $client.Close(); continue }

    $requestLine = ($raw -split "`r`n")[0]
    $parts = $requestLine -split ' '
    $method = $parts[0]
    $target = if ($parts.Length -gt 1) { $parts[1] } else { "/" }
    $target = ($target -split '\?')[0]
    if ($target -eq "/") { $target = "/index.html" }

    # decode %XX and refuse anything trying to climb out of the site root
    $decoded = [System.Uri]::UnescapeDataString($target).TrimStart('/')
    $decoded = $decoded -replace '/', '\'
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $decoded))
    $rootFull = [System.IO.Path]::GetFullPath($root)
    $headOnly = ($method -eq "HEAD")

    if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
      Send-Response $stream 403 "Forbidden" "text/plain" ([System.Text.Encoding]::UTF8.GetBytes("403")) $headOnly
    }
    elseif (($method -ne "GET") -and (-not $headOnly)) {
      Send-Response $stream 405 "Method Not Allowed" "text/plain" ([System.Text.Encoding]::UTF8.GetBytes("405")) $false
    }
    elseif (Test-Path $full -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = $mime[$ext]
      if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      Send-Response $stream 200 "OK" $ct $bytes $headOnly
    }
    else {
      Send-Response $stream 404 "Not Found" "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $target")) $headOnly
    }
  } catch {
    # a dropped connection shouldn't take the server down
  } finally {
    if ($client) { $client.Close() }
  }
}
