# Dev-only (A3): will the game load the same on Cloudflare as on Windows?
#   1. every path the game references matches a committed file in public/
#      letter for letter -- Windows does not care about upper/lower case, web
#      servers do: Words.js is not words.js
#   2. every file the game needs is committed (not left out, not ignored)
#   3. no path of this machine (C:\..., file:///) is left in the code
# (new series, round 1, A) and what Cloudflare would upload -- public/ only:
#   4. no file over 25 MiB (Cloudflare refuses it); over 5 MB is reported
#   5. nothing private: only the kinds of file a web page uses, no tools,
#      saves, spreadsheets, keys or tokens (everything in public/ is public)
#   6. public/version.json lists exactly the files there, as they are now
#      (else: powershell -File tools\make-version.ps1)
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File .\tools\check-paths.ps1
# Exit code 0 when clean, 1 when something is wrong.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$web = Join-Path $root 'public'
Set-Location $web
$tracked = @(git ls-files -- . | ForEach-Object { $_ })    # relative to public/, exact case
$trackedSet = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
$tracked | ForEach-Object { [void]$trackedSet.Add($_) }
$lower = @{}; $tracked | ForEach-Object { $lower[$_.ToLowerInvariant()] = $_ }
$problems = New-Object System.Collections.Generic.List[string]
$notes = New-Object System.Collections.Generic.List[string]
$refs = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)

function Add-Ref([string]$p, [string]$from) {
  if (-not $p) { return }
  if ($p -match '^(https?:|data:|blob:|mailto:|#|javascript:)') { return }
  $p = ($p -split '[?#]')[0]
  if (-not $p -or $p -eq './' -or $p -eq '/') { return }
  $p = $p -replace '^\./', ''
  $base = Split-Path -Parent $from
  if ($from -like 'css/*' -and -not $p.StartsWith('/')) { $p = (Join-Path $base $p) -replace '\\', '/' }
  $p = $p.TrimStart('/')
  # fold a/b/../c
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($s in $p.Split('/')) { if ($s -eq '..') { if ($parts.Count) { $parts.RemoveAt($parts.Count - 1) } } elseif ($s -ne '.' -and $s) { $parts.Add($s) } }
  [void]$refs.Add(($parts -join '/') + '|' + $from)
}

# index.html: every src= and href=
$html = Get-Content -Raw -Encoding UTF8 'index.html'
[regex]::Matches($html, '(?:src|href)="([^"]+)"') | ForEach-Object { Add-Ref $_.Groups[1].Value 'index.html' }
# the stylesheet: url(...)
Get-ChildItem css -Filter *.css | ForEach-Object {
  $t = Get-Content -Raw -Encoding UTF8 $_.FullName
  [regex]::Matches($t, 'url\(\s*[''"]?([^''")]+)[''"]?\s*\)') | ForEach-Object { Add-Ref $_.Groups[1].Value ('css/' + $_.Name) }
}
# the scripts: literal paths to game files
Get-ChildItem js -Recurse -Filter *.js | ForEach-Object {
  $rel = (Resolve-Path -Relative $_.FullName) -replace '^\.\\', '' -replace '\\', '/'
  $t = Get-Content -Raw -Encoding UTF8 $_.FullName
  [regex]::Matches($t, '["''`]((?:assets|icons|js|css)/[^"''`$\s]+\.(?:js|css|png|jpg|jpeg|webp|json|svg|mp3|ogg|wav))["''`]') | ForEach-Object { Add-Ref $_.Groups[1].Value $rel }
  [regex]::Matches($t, 'register\("([^"]+)"\)') | ForEach-Object { Add-Ref $_.Groups[1].Value $rel }
}
# built at run time: the lobby's artwork, one picture and one card per mode
$lobby = Get-Content -Raw -Encoding UTF8 'js/lobby.js'
# (a mode with `art: "x"` borrows another's pictures)
[regex]::Matches($lobby, '\{ id: "(\w+)", tab:[^\r\n]*') | ForEach-Object {
  $art = [regex]::Match($_.Value, 'art: "(\w+)"')
  $name = if ($art.Success) { $art.Groups[1].Value } else { $_.Groups[1].Value }
  Add-Ref ('assets/lobby/' + $name + '.jpg') 'js/lobby.js (art)'
  Add-Ref ('assets/lobby/' + $name + '-card.jpg') 'js/lobby.js (art)'
}
# the manifest's icons
$man = Get-Content -Raw -Encoding UTF8 'manifest.json' | ConvertFrom-Json
$man.icons | ForEach-Object { Add-Ref $_.src 'manifest.json' }

$checked = 0
foreach ($r in $refs) {
  $p, $from = $r.Split('|', 2)
  $checked++
  if ($trackedSet.Contains($p)) { continue }
  $ci = $lower[$p.ToLowerInvariant()]
  if ($ci) { $problems.Add("CASE     public/$p  (from $from)  -- the committed file is $ci"); continue }
  if (Test-Path -LiteralPath $p) {
    $ign = git check-ignore $p 2>$null
    if ($ign) { $problems.Add("IGNORED  public/$p  (from $from)  -- exists but .gitignore leaves it out") }
    else { $problems.Add("UNTRACKED public/$p  (from $from)  -- exists but is not committed") }
  } else { $problems.Add("MISSING  public/$p  (from $from)") }
}

# 3. paths of this machine, in anything committed that the game or its tools read
Set-Location $root
@(git ls-files | ForEach-Object { $_ }) | Where-Object { $_ -match '\.(js|mjs|css|html|json|jsonc|webmanifest)$' } | ForEach-Object {
  $t = Get-Content -Raw -Encoding UTF8 $_
  $m = [regex]::Matches($t, '(?i)(file:///|[a-z]:\\\\?(users|windows|program files)|/c/users/)')
  foreach ($x in $m) { $problems.Add("ABSOLUTE $_  -- '" + $x.Value + "'") }
}

# 4-5. what would be uploaded: every file in public/ (as Cloudflare sees the
# folder, ignored files included -- .assetsignore aside)
$ignoreRules = @()
if (Test-Path (Join-Path $web '.assetsignore')) { $ignoreRules = @(Get-Content (Join-Path $web '.assetsignore') | Where-Object { $_ -and -not $_.StartsWith('#') }) }
$allowed = @('.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico', '.mp3', '.ogg', '.wav', '.woff', '.woff2', '.txt', '.webmanifest')
$special = @('_headers', '_redirects', '.assetsignore')
$upload = 0; $uploadBytes = 0
Get-ChildItem -LiteralPath $web -Recurse -File -Force | ForEach-Object {
  $rel = $_.FullName.Substring($web.Length + 1).Replace('\', '/')
  $name = $_.Name
  if ($ignoreRules | Where-Object { $name -like $_ }) { return }
  if ($rel -eq '.assetsignore') { return }
  $upload++; $uploadBytes += $_.Length
  if ($_.Length -gt 25MB) { $problems.Add(("TOO BIG  public/{0}  -- {1:N1} MiB: Cloudflare takes 25 MiB a file at most" -f $rel, ($_.Length / 1MB))) }
  elseif ($_.Length -gt 5MB) { $notes.Add(("big      public/{0}  -- {1:N1} MB (aim: 5 MB or less)" -f $rel, ($_.Length / 1MB))) }
  $ext = $_.Extension.ToLowerInvariant()
  if (-not ($special -contains $rel) -and -not ($allowed -contains $ext)) { $problems.Add("PRIVATE? public/$rel  -- not a kind of file the game uses; everything in public/ can be downloaded by anyone") }
  if ($ext -in @('.js', '.html', '.json', '.css', '.txt')) {
    $t = [IO.File]::ReadAllText($_.FullName)
    $s = [regex]::Match($t, '(?i)(-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(sk|rk)_(live|test)_[0-9a-z]{10,}|\bghp_[0-9a-z]{20,}|\bAKIA[0-9A-Z]{16}\b|"private_key"\s*:|client_secret|api[_-]?secret)')
    if ($s.Success) { $problems.Add("SECRET?  public/$rel  -- '" + $s.Value + "'") }
  }
}

# 6. version.json: the files there now, and their hashes
$vPath = Join-Path $web 'version.json'
if (-not (Test-Path $vPath)) { $problems.Add("MISSING  public/version.json  -- run tools\make-version.ps1") }
else {
  $v = Get-Content -Raw -Encoding UTF8 $vPath | ConvertFrom-Json
  $listed = @($v.files.PSObject.Properties | ForEach-Object { $_.Name })
  $skipV = @('version.json', '_headers', '.assetsignore', 'sw.js')
  $textExt = @('.html', '.js', '.css', '.json', '.txt', '.svg', '.webmanifest', '.csv')
  $sha = [System.Security.Cryptography.SHA256]::Create(); $utf8 = New-Object Text.UTF8Encoding $false
  $stale = @()
  $present = @(Get-ChildItem -LiteralPath $web -Recurse -File -Force | ForEach-Object { $_.FullName.Substring($web.Length + 1).Replace('\', '/') } | Where-Object { $skipV -notcontains $_ })
  foreach ($p in $present) {
    if ($listed -notcontains $p) { $stale += "$p (not listed)"; continue }
    $bytes = [IO.File]::ReadAllBytes((Join-Path $web $p))
    if ($textExt -contains [IO.Path]::GetExtension($p).ToLowerInvariant()) { $bytes = $utf8.GetBytes($utf8.GetString($bytes).Replace("`r`n", "`n")) }
    $h = (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 16)
    if ($h -ne $v.files.$p.hash) { $stale += "$p (changed)" }
  }
  foreach ($p in $listed) { if ($present -notcontains $p) { $stale += "$p (gone)" } }
  if ($stale.Count) { $problems.Add("STALE    public/version.json ($($v.version)) -- " + (($stale | Select-Object -First 6) -join ', ') + $(if ($stale.Count -gt 6) { " and $($stale.Count - 6) more" } else { '' }) + " -- run tools\make-version.ps1") }
}

"checked $checked references against $($tracked.Count) committed files in public/"
("public/ would upload {0} files, {1:N1} MB" -f $upload, ($uploadBytes / 1MB))
if ($notes.Count) { $notes | ForEach-Object { "  " + $_ } }
if ($problems.Count) { $problems | ForEach-Object { "  " + $_ }; "PROBLEMS: $($problems.Count)"; exit 1 }
"OK: every path matches a committed file exactly; nothing ignored; no machine paths; nothing too big or private; version.json is current"
exit 0
