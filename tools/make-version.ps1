# Writes public/version.json: the game's version, and every file of it with
# its size and a hash (new series, round 1, C1). The update check reads it
# (js/updater.js): a new build -> "Update Available", and only the files whose
# hash changed are downloaded again.
#
# This is the copy for this computer. On Cloudflare the same file is written
# by tools/make-version.mjs (Node) at every deploy -- the two must agree:
#   version  "YYYY.MM.DD-HHMM", the build time in Thailand (UTC+7)
#   build    the build time in ms (what is compared)
#   files    path -> { size, hash }: text files hashed with CRLF read as LF
#            (git stores them that way, and that is what is deployed)
#
#   powershell -ExecutionPolicy Bypass -File tools\make-version.ps1 [-Message "what changed"] [-Root <site folder>]
param([string]$Message = "", [string]$Root = "", [string]$Commit = "")
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = Join-Path $repo 'public' }
$Root = (Resolve-Path $Root).Path
$skip = @('version.json', '_headers', '.assetsignore', 'sw.js')
$textExt = @('.html', '.js', '.css', '.json', '.txt', '.svg', '.webmanifest', '.csv')
$sha = [System.Security.Cryptography.SHA256]::Create()

$files = [ordered]@{}
$total = 0
Get-ChildItem -LiteralPath $Root -Recurse -File -Force | ForEach-Object { $_ } |
  Sort-Object { $_.FullName.Substring($Root.Length + 1).Replace('\', '/') } -CaseSensitive |
  ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length + 1).Replace('\', '/')
    if ($skip -contains $rel) { return }
    $bytes = [IO.File]::ReadAllBytes($_.FullName)
    if ($textExt -contains $_.Extension.ToLowerInvariant()) {
      # CRLF -> LF (UTF-8 throughout; a BOM is kept as it is)
      $utf8 = New-Object Text.UTF8Encoding $false
      $bytes = $utf8.GetBytes($utf8.GetString($bytes).Replace("`r`n", "`n"))
    }
    $hash = (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, 16)
    $files[$rel] = [ordered]@{ size = $bytes.Length; hash = $hash }
    $total += $bytes.Length
  }

# what is fetched from elsewhere: the <script src="https://..."> of the page
$external = @()
$html = [IO.File]::ReadAllText((Join-Path $Root 'index.html'))
[regex]::Matches($html, '<script src="(https://[^"]+)"') | ForEach-Object { $external += $_.Groups[1].Value }

# (git writes UTF-8: the commit messages are partly Thai)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false
$now = [DateTimeOffset]::UtcNow
$th = $now.ToOffset([TimeSpan]::FromHours(7))
if (-not $Commit) { try { $Commit = (git -C $repo rev-parse --short=7 HEAD 2>$null) } catch { $Commit = '' } }
# what changed: the last commits, newest first, each { c: commit, s: subject }
# (the game shows those since the version a device has); -Message: one more
# on top, for what is about to be committed
$changes = @()
if ($Message) { $changes += [ordered]@{ c = ""; s = ($Message -split "`r?`n")[0].Trim() } }
try { @(git -C $repo log -n 8 --format="%h`t%s" --abbrev=7 2>$null) | ForEach-Object { $p = $_ -split "`t", 2; if ($p.Count -eq 2) { $changes += [ordered]@{ c = $p[0].Substring(0, [Math]::Min(7, $p[0].Length)); s = $p[1] } } } } catch {}
$changes = @($changes | Where-Object { $_.s } | ForEach-Object { if ($_.s.Length -gt 140) { $_.s = $_.s.Substring(0, 140) }; $_ } | Select-Object -First 8)

$v = [ordered]@{
  format = 1
  version = $th.ToString('yyyy.MM.dd-HHmm')
  build = $now.ToUnixTimeMilliseconds()
  date = $now.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
  commit = "$Commit"
  source = 'local'
  changes = $changes
  total = $total
  external = $external
  files = $files
}
$json = $v | ConvertTo-Json -Depth 5 -Compress
[IO.File]::WriteAllText((Join-Path $Root 'version.json'), $json + "`n", (New-Object Text.UTF8Encoding $false))
"version.json: $($v.version)  build $($v.build)  commit $Commit  $($files.Count) files, $([Math]::Round($total / 1MB, 2)) MB"
