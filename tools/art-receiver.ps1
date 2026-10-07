# ===================================================================
# Dev-only: saves the artwork tools/art-render.js renders in the game.
# -------------------------------------------------------------------
# The page POSTs a canvas data URL (JPEG, PNG or WebP) to
#   http://localhost:8092/?name=<folder>/<file>
# and it is written to public/assets/<folder>/<file>. Only the art folders
# (lobby, boot) and image names are accepted; it listens on this computer
# only. Start it, render, then close it:
#   powershell -ExecutionPolicy Bypass -File tools\art-receiver.ps1
# ===================================================================
param([int]$Port = 8092)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$assets = Join-Path $root 'public\assets'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
"art receiver on http://localhost:$Port/ -> $assets"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $ctx.Response.Headers.Add('Access-Control-Allow-Origin', '*')
  try {
    $name = [string]$ctx.Request.QueryString['name']
    if ($name -notmatch '^(lobby|boot)/[a-z0-9-]+\.(jpg|png|webp)$') { throw "bad name: $name" }
    $reader = New-Object IO.StreamReader($ctx.Request.InputStream)
    $body = $reader.ReadToEnd(); $reader.Close()
    $b64 = $body -replace '^data:image/[a-z]+;base64,', ''
    $out = Join-Path $assets ($name -replace '/', '\')
    $dir = Split-Path -Parent $out
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    $bytes = [Convert]::FromBase64String($b64)
    [IO.File]::WriteAllBytes($out, $bytes)
    "saved $name ($([Math]::Round($bytes.Length / 1024)) KB)"
    $msg = [Text.Encoding]::UTF8.GetBytes("saved $($bytes.Length)")
    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
  } catch {
    $ctx.Response.StatusCode = 500
    "error: $($_.Exception.Message)"
  } finally { $ctx.Response.OutputStream.Close() }
}
