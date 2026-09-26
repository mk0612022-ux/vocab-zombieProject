# Lists every line that still contains Thai characters (U+0E00-U+0E7F) in the
# game's code, markup and styles. Vocabulary data (js/data/words_*.js) is
# skipped on purpose: the Thai meanings there are part of the game.
#
#   powershell -ExecutionPolicy Bypass -File tools\thai-scan.ps1
#
# Exit code 0 = clean, 1 = Thai text found.
$root = Split-Path -Parent $PSScriptRoot
$skip = @('js\data\words_school.js', 'js\data\words_hospital.js', 'js\data\words_bunker.js')
$files = Get-ChildItem -Path $root -Recurse -File -Include *.js, *.html, *.css, *.json, *.ps1 |
  Where-Object { $_.FullName -notmatch '\\(\.git|node_modules|screenshots)\\' }
$hits = 0; $scanned = 0; $skipped = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($root.Length + 1)
  if ($skip -contains $rel) { $skipped += $rel; continue }
  $scanned++
  $n = 0
  foreach ($line in [System.IO.File]::ReadAllLines($f.FullName, [System.Text.Encoding]::UTF8)) {
    $n++
    if ($line -match '[\u0E00-\u0E7F]') {
      $hits++
      $t = $line.Trim(); if ($t.Length -gt 110) { $t = $t.Substring(0, 110) + '...' }
      Write-Output ("{0}:{1}: {2}" -f $rel, $n, $t)
    }
  }
}
Write-Output ("scanned {0} files, skipped vocab data: {1}" -f $scanned, ($skipped -join ', '))
Write-Output ("Thai lines found: {0}" -f $hits)
if ($hits) { exit 1 } else { exit 0 }
