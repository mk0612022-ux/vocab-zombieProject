# ===================================================================
# check-strings (round 3, H2): the UI text in all four languages
# -------------------------------------------------------------------
# Reads the English table in public/js/strings.js (G.STRINGS.en) and the
# other three languages' files -- public/js/strings-th.js, strings-zh.js,
# strings-fr.js -- and reports, for each language:
#   - every key of the English table that it does not have (missing)
#   - every key it has that English does not (extra: a typo, or left over)
#   - every string whose {placeholders} are not exactly the English ones
#   - every string whose markup (<b>, <kbd>, <li>, ...) does not match the
#     English, tag for tag, and whose line breaks (\n) are not the same
#   - an empty string where English has text
# and prints the counts. A key the game uses that English lacks is not this
# script's job: the game logs those (G._missingKeys, tests/round17).
#
#   powershell -ExecutionPolicy Bypass -File tools\check-strings.ps1
# Exit code 0 when all four languages have every key, 1 otherwise.
# (This file is ASCII on purpose: Windows PowerShell 5.1 reads a script
# without a byte-order mark in the ANSI code page.)
# ===================================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding $false

# A JavaScript object literal of "key": "text" + "more text", ... ->
# ordered dictionary. Understands // and /* */ comments, double-quoted
# strings with escapes, and + between strings; nothing else is expected
# in these tables.
function Read-Table([string]$text, [int]$start) {
  $out = [ordered]@{}
  $i = $start; $n = $text.Length
  $depth = 0; $key = $null; $val = $null; $expectVal = $false
  while ($i -lt $n) {
    $c = $text[$i]
    if ($c -eq '/' -and $i + 1 -lt $n -and $text[$i + 1] -eq '/') { while ($i -lt $n -and $text[$i] -ne "`n") { $i++ }; continue }
    if ($c -eq '/' -and $i + 1 -lt $n -and $text[$i + 1] -eq '*') { $j = $text.IndexOf('*/', $i + 2); $i = if ($j -lt 0) { $n } else { $j + 2 }; continue }
    if ($c -eq '{') { $depth++; $i++; continue }
    if ($c -eq '}') {
      $depth--
      if ($null -ne $key -and $null -ne $val) { $out[$key] = $val }
      $key = $null; $val = $null; $expectVal = $false
      if ($depth -le 0) { return $out }
      $i++; continue
    }
    if ($c -eq '"') {
      $sb = New-Object Text.StringBuilder
      $i++
      while ($i -lt $n -and $text[$i] -ne '"') {
        if ($text[$i] -eq '\' -and $i + 1 -lt $n) {
          $e = $text[$i + 1]
          switch ($e) { 'n' { [void]$sb.Append("`n") } 't' { [void]$sb.Append("`t") } default { [void]$sb.Append($e) } }
          $i += 2; continue
        }
        [void]$sb.Append($text[$i]); $i++
      }
      $i++
      $s = $sb.ToString()
      if ($expectVal) { if ($null -eq $val) { $val = $s } else { $val += $s } }
      else { $key = $s }
      continue
    }
    if ($c -eq ':') { $expectVal = $true; $val = $null; $i++; continue }
    if ($c -eq ',') { if ($null -ne $key -and $null -ne $val) { $out[$key] = $val }; $key = $null; $val = $null; $expectVal = $false; $i++; continue }
    $i++
  }
  return $out
}

function Get-Placeholders([string]$s) { return @([regex]::Matches($s, '\{(\w+)\}') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique) }
function Get-Tags([string]$s) { return (@([regex]::Matches($s, '</?([a-zA-Z0-9]+)') | ForEach-Object { $_.Value.ToLowerInvariant() }) -join ' ') }

$enText = [IO.File]::ReadAllText((Join-Path $root 'public/js/strings.js'), $utf8)
$m = [regex]::Match($enText, '(?m)^\s*en:\s*\{')
if (-not $m.Success) { "strings.js: the en table was not found"; exit 1 }
$en = Read-Table $enText ($m.Index + $m.Value.IndexOf('{'))
"English (strings.js): $($en.Count) keys"

$bad = 0
foreach ($l in 'th', 'zh', 'fr') {
  $path = Join-Path $root "public/js/strings-$l.js"
  if (-not (Test-Path $path)) { "  $l : MISSING FILE public/js/strings-$l.js"; $bad++; continue }
  $t = [IO.File]::ReadAllText($path, $utf8)
  $mm = [regex]::Match($t, "G\.STRINGS\.$l\s*=\s*\{")
  if (-not $mm.Success) { "  $l : no G.STRINGS.$l = { ... } in strings-$l.js"; $bad++; continue }
  $tab = Read-Table $t ($mm.Index + $mm.Value.IndexOf('{'))
  $missing = @($en.Keys | Where-Object { -not $tab.Contains($_) })
  $extra = @($tab.Keys | Where-Object { -not $en.Contains($_) })
  $ph = New-Object System.Collections.Generic.List[string]
  $tags = New-Object System.Collections.Generic.List[string]
  $empty = New-Object System.Collections.Generic.List[string]
  foreach ($k in $en.Keys) {
    if (-not $tab.Contains($k)) { continue }
    $a = [string]$en[$k]; $b = [string]$tab[$k]
    $pa = (Get-Placeholders $a) -join ','; $pb = (Get-Placeholders $b) -join ','
    if ($pa -ne $pb) { $ph.Add("$k  en {$pa} / $l {$pb}") }
    if ((Get-Tags $a) -ne (Get-Tags $b)) { $tags.Add("$k  en [$(Get-Tags $a)] / $l [$(Get-Tags $b)]") }
    elseif (([regex]::Matches($a, "`n")).Count -ne ([regex]::Matches($b, "`n")).Count) { $tags.Add("$k  line breaks differ") }
    if ($a.Trim() -and -not $b.Trim()) { $empty.Add($k) }
  }
  $n = $missing.Count + $extra.Count + $ph.Count + $tags.Count + $empty.Count
  "  {0} (strings-{0}.js): {1} keys -- missing {2}, extra {3}, placeholders {4}, markup {5}, empty {6}" -f $l, $tab.Count, $missing.Count, $extra.Count, $ph.Count, $tags.Count, $empty.Count
  foreach ($x in $missing) { "      missing: $x" }
  foreach ($x in $extra) { "      extra: $x" }
  foreach ($x in $ph) { "      placeholders: $x" }
  foreach ($x in $tags) { "      markup: $x" }
  foreach ($x in $empty) { "      empty: $x" }
  $bad += $n
}
if ($bad) { "FAILED: $bad problem(s)"; exit 1 }
"OK: all four languages have every key, with the same placeholders and markup"
exit 0
