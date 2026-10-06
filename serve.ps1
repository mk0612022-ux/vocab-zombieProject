# (new series, round 1, A3) the site is public/, as on Cloudflare; /tools/ is
# mapped to the repo's tools folder on this dev server only; captures go to
# ..\vocab-zombieProject-files\_review (outside the repo)
$root = Join-Path $PSScriptRoot "public"
$tools = Join-Path $PSScriptRoot "tools"
$captures = Join-Path (Split-Path -Parent $PSScriptRoot) "vocab-zombieProject-files\_review"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Serving $root at http://localhost:8080/"

$mime = @{
  ".html" = "text/html"; ".css" = "text/css"; ".js" = "application/javascript";
  ".json" = "application/json"; ".png" = "image/png"; ".jpg" = "image/jpeg";
  ".svg" = "image/svg+xml"; ".ico" = "image/x-icon"; ".webp" = "image/webp";
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $req = $context.Request
  $res = $context.Response
  try {
    $path = $req.Url.LocalPath
    if ($req.HttpMethod -eq "POST" -and $path -eq "/save-screenshot") {
      # Dev-only capture endpoint: the browser POSTs {name, dataUrl} JSON here so
      # design-review screenshots can be written straight to disk for the user,
      # instead of round-tripping huge base64 strings through the chat transcript.
      $reader = New-Object IO.StreamReader($req.InputStream, $req.ContentEncoding)
      $body = $reader.ReadToEnd()
      $reader.Close()
      $data = $body | ConvertFrom-Json
      $b64 = $data.dataUrl -replace '^data:image/png;base64,', ''
      $bytes = [Convert]::FromBase64String($b64)
      $outDir = $captures
      if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
      $safeName = $data.name -replace '[^a-zA-Z0-9_-]', '_'
      $outFile = Join-Path $outDir "$safeName.png"
      [IO.File]::WriteAllBytes($outFile, $bytes)
      $res.Headers.Add("Access-Control-Allow-Origin", "*")
      $msg = [System.Text.Encoding]::UTF8.GetBytes("saved $safeName.png")
      $res.OutputStream.Write($msg, 0, $msg.Length)
      $res.OutputStream.Close()
      continue
    }
    if ($path -eq "/") { $path = "/index.html" }
    $rel = $path.TrimStart("/")
    $filePath = if ($rel -like "tools/*") { Join-Path $tools $rel.Substring(6) } else { Join-Path $root $rel }
    if (Test-Path $filePath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($filePath)
      $contentType = $mime[$ext]
      if (-not $contentType) { $contentType = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $res.ContentType = $contentType
      $res.ContentLength64 = $bytes.Length
      # No cache headers were being sent, so browsers were free to reuse their own
      # heuristically-cached copy of .js/.css files on a normal refresh -- meaning a
      # fix saved to disk could still appear "not fixed" in the browser until a hard
      # refresh. Force revalidation on every request so this dev server always serves
      # what's actually on disk.
      $res.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate")
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.OutputStream.Close()
  }
}
