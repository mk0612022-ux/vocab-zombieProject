param([Parameter(Mandatory = $true)][string[]]$Path, [string]$Bank = "", [string]$Out = "")
# Dev-only (not shipped). Reads players' .vzwords files (js/wordreport.js) and
# lists them word by word against the Master Word Bank (word-bank.csv): how many
# reports and of what kind, the notes, what the player saw, what the bank says
# now and on which line. Most reported first. -Out <file.md> also writes the
# list to a file.
# This only reads. Nothing here changes a word: a person checks each report and
# edits the bank by hand (then tools/words-import.ps1).
$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$repo = Split-Path -Parent $PSScriptRoot
if (-not $Bank) { $Bank = Join-Path $repo "word-bank.csv" }
$reports = @()
foreach ($p in $Path) {
  $j = [IO.File]::ReadAllText((Resolve-Path $p), $utf8) | ConvertFrom-Json
  if ($j.app -ne "vocab-zombie" -or $j.kind -ne "words") { throw "not a Vocab Zombie word report: $p" }
  $reports += @($j.reports)
}
# the bank by id, with each row's line in the file (the first line is the header)
$rows = @{}
$line = 1
foreach ($row in (Import-Csv -Path $Bank -Encoding UTF8)) { $line++; $rows[$row.id] = @{ row = $row; line = $line } }

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("$($reports.Count) report(s) on $(@($reports | Select-Object -ExpandProperty wordId -Unique).Count) word(s)")
$groups = $reports | Group-Object wordId | Sort-Object Count -Descending
foreach ($g in $groups) {
  $first = $g.Group[0]
  $id = ($g.Name -split "@")[0]
  $kinds = ($g.Group | Group-Object type | ForEach-Object { "$($_.Name) x$($_.Count)" }) -join ", "
  $lines.Add("")
  $lines.Add("## $($g.Name)  ($kinds)")
  $e = $rows[$id]
  if ($e) {
    $b = $e.row
    $lines.Add("bank line $($e.line): $($b.headword) ($($b.partOfSpeech)) th=$($b.thai) zh=$($b.zh) fr=$($b.fr)")
    if ($b.definition) { $lines.Add("definition: $($b.definition)") }
  } elseif ($first.custom) { $lines.Add("the player's own word: not in the bank") }
  else { $lines.Add("not found in the bank") }
  foreach ($r in $g.Group) {
    $lines.Add("- $($r.at) [$($r.type)] $($r.wl)>$($r.ml), from $($r.where), game $($r.gameVersion)$(if ($r.note) { ': ' + $r.note })")
    if ($r.shown) { "$($r.shown)" -split "`n" | ForEach-Object { if ($_) { $lines.Add("    $_") } } }
  }
}
$lines
if ($Out) { [IO.File]::WriteAllLines($Out, $lines, $utf8); ""; "written to $Out" }
