# Dev-only (A3): will the game load the same on a web host as on Windows?
#   1. every path the game references matches a committed file letter for
#      letter -- Windows does not care about upper/lower case, web servers
#      (GitHub Pages, Netlify, Cloudflare) do: Words.js is not words.js
#   2. every file the game needs is committed (not left out, not ignored)
#   3. no path of this machine (C:\..., file:///) is left in the code
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File .\tools\check-paths.ps1
# Exit code 0 when clean, 1 when something is wrong.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$tracked = @(git ls-files)                       # exact case, as the host will serve them
$trackedSet = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
$tracked | ForEach-Object { [void]$trackedSet.Add($_) }
$lower = @{}; $tracked | ForEach-Object { $lower[$_.ToLowerInvariant()] = $_ }
$problems = New-Object System.Collections.Generic.List[string]
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
# the service worker's own list, and the manifest's icons
$sw = Get-Content -Raw -Encoding UTF8 'sw.js'
[regex]::Matches($sw, '"\./([^"]+)"') | ForEach-Object { Add-Ref $_.Groups[1].Value 'sw.js' }
$man = Get-Content -Raw -Encoding UTF8 'manifest.json' | ConvertFrom-Json
$man.icons | ForEach-Object { Add-Ref $_.src 'manifest.json' }

$checked = 0
foreach ($r in $refs) {
  $p, $from = $r.Split('|', 2)
  $checked++
  if ($trackedSet.Contains($p)) { continue }
  $ci = $lower[$p.ToLowerInvariant()]
  if ($ci) { $problems.Add("CASE     $p  (from $from)  -- the committed file is $ci"); continue }
  if (Test-Path -LiteralPath $p) {
    $ign = git check-ignore $p 2>$null
    if ($ign) { $problems.Add("IGNORED  $p  (from $from)  -- exists but .gitignore leaves it out") }
    else { $problems.Add("UNTRACKED $p  (from $from)  -- exists but is not committed") }
  } else { $problems.Add("MISSING  $p  (from $from)") }
}

# 3. paths of this machine, in anything committed that the game or its tools read
$abs = 0
$tracked | Where-Object { $_ -match '\.(js|css|html|json|webmanifest)$' } | ForEach-Object {
  $t = Get-Content -Raw -Encoding UTF8 $_
  $m = [regex]::Matches($t, '(?i)(file:///|[a-z]:\\\\?(users|windows|program files)|/c/users/)')
  foreach ($x in $m) { $abs++; $problems.Add("ABSOLUTE $_  -- '" + $x.Value + "'") }
}

"checked $checked references against $($tracked.Count) committed files"
if ($problems.Count) { $problems | ForEach-Object { "  " + $_ }; "PROBLEMS: $($problems.Count)"; exit 1 }
"OK: every path matches a committed file exactly; nothing ignored; no machine paths"
exit 0
