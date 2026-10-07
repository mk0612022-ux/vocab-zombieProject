# Lists every line that still contains Thai characters (U+0E00-U+0E7F) in the
# game's code, markup and styles. Vocabulary data (the word bank
# public/js/data/bank_*.js, confusables.js, words_bosses.js) is
# skipped on purpose: the Thai meanings there are part of the game. So is
# public/version.json (the commit messages it lists for the update screen),
# and (round 3) public/js/strings-th.js, the Thai of the menus.
#
#   powershell -ExecutionPolicy Bypass -File tools\thai-scan.ps1
#
# Exit code 0 = clean, 1 = Thai text found.
$root = Split-Path -Parent $PSScriptRoot
# (round 3, H2: the Thai UI strings are Thai on purpose -- js/strings-th.js)
$skip = @('public\js\data\bank_school.js', 'public\js\data\bank_hospital.js', 'public\js\data\bank_bunker.js', 'public\js\data\confusables.js', 'public\js\data\words_bosses.js', 'public\js\strings-th.js', 'public\version.json')
$files = Get-ChildItem -Path $root -Recurse -File -Include *.js, *.html, *.css, *.json, *.ps1 |
  Where-Object { $_.FullName -notmatch '\\(\.git|node_modules|\.wrangler|screenshots|_review)\\' }
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
