# ===================================================================
# Shared by tools/words-export.ps1 and tools/words-import.ps1: reading
# and writing the word bank's data files (js/data/bank_*.js,
# js/data/confusables.js). The game loads them with plain <script> tags,
# so it runs from a folder on disk as well as from a web host; the JSON
# inside sits between /*BANK*/ (or /*CONFUSABLES*/) and /*END*/ for these
# scripts to find.
# ===================================================================
$script:utf8NoBom = New-Object Text.UTF8Encoding $false
$script:BANK_FILES = @{ 1 = 'bank_school.js'; 2 = 'bank_hospital.js'; 3 = 'bank_bunker.js' }
$script:LEVEL_NAMES = @{ 1 = 'Abandoned School'; 2 = 'Abandoned Hospital'; 3 = 'Underground Bunker' }
$script:TOPIC_ORDER = @('General Academic', 'Education', 'Society & Culture', 'Media & Communication', 'Health', 'Science & Research',
  'Environment', 'Technology', 'Government & Law', 'Crime & Security', 'Work & Economy', 'Urban Life & Transport')
# the fields of an entry, in the order they are written
$script:FIELDS = @('id', 'headword', 'partOfSpeech', 'acceptedSpellings', 'thai', 'definition', 'synonyms', 'examples', 'collocations',
  'family', 'topic', 'level', 'source', 'awlSublist', 'awlHeadword', 'aliases', 'confusables', 'commonMisspellings', 'stress', 'paraphrase')
$script:OPTIONAL = @('awlSublist', 'awlHeadword', 'aliases', 'confusables', 'commonMisspellings', 'stress', 'paraphrase')

function Read-DataBlock([string]$path, [string]$marker) {
  $t = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
  $open = '/*' + $marker + '*/'
  $a = $t.IndexOf($open); $b = $t.IndexOf('/*END*/')
  if ($a -lt 0 -or $b -lt $a) { throw "$path : markers $open ... /*END*/ not found" }
  $json = $t.Substring($a + $open.Length, $b - $a - $open.Length).Trim()
  if (-not $json -or $json -eq '[]') { return @() }
  # Windows PowerShell 5.1 passes a parsed JSON array down the pipeline as
  # one object; ForEach-Object unrolls it
  return @($json | ConvertFrom-Json | ForEach-Object { $_ })
}

function ConvertTo-JsonString([string]$s) {
  $b = New-Object Text.StringBuilder
  [void]$b.Append('"')
  foreach ($ch in $s.ToCharArray()) {
    switch ($ch) {
      '"' { [void]$b.Append('\"') }
      '\' { [void]$b.Append('\\') }
      "`n" { [void]$b.Append('\n') }
      "`r" { [void]$b.Append('\r') }
      "`t" { [void]$b.Append('\t') }
      default { if ([int]$ch -lt 32) { [void]$b.Append(('\u{0:x4}' -f [int]$ch)) } else { [void]$b.Append($ch) } }
    }
  }
  [void]$b.Append('"')
  return $b.ToString()
}
function ConvertTo-JsonValue($v) {
  if ($null -eq $v) { return 'null' }
  if ($v -is [string]) { return ConvertTo-JsonString $v }
  if ($v -is [bool]) { if ($v) { return 'true' } else { return 'false' } }
  if ($v -is [int] -or $v -is [long] -or $v -is [double] -or $v -is [decimal]) { return [string]$v }
  if ($v -is [System.Collections.IDictionary]) {
    $parts = foreach ($k in $v.Keys) { (ConvertTo-JsonString ([string]$k)) + ':' + (ConvertTo-JsonValue $v[$k]) }
    return '{' + ($parts -join ',') + '}'
  }
  if ($v -is [System.Management.Automation.PSCustomObject]) {
    $parts = foreach ($p in $v.PSObject.Properties) { if ($p.Name -notlike '__*') { (ConvertTo-JsonString $p.Name) + ':' + (ConvertTo-JsonValue $p.Value) } }
    return '{' + ($parts -join ',') + '}'
  }
  if ($v -is [System.Collections.IEnumerable]) {
    $parts = foreach ($x in $v) { ConvertTo-JsonValue $x }
    return '[' + ($parts -join ',') + ']'
  }
  return ConvertTo-JsonString ([string]$v)
}

# one entry as one line of JSON, the fields in their fixed order, empty
# optional fields left out
function ConvertTo-EntryJson($e) {
  $o = [ordered]@{}
  foreach ($f in $script:FIELDS) {
    $p = $e.PSObject.Properties[$f]
    $v = if ($p) { $p.Value } elseif ($e -is [System.Collections.IDictionary] -and $e.Contains($f)) { $e[$f] } else { $null }
    if ($script:OPTIONAL -contains $f) {
      if ($null -eq $v -or ($v -is [string] -and -not $v) -or ($v -is [array] -and $v.Count -eq 0)) { continue }
    }
    if (@('acceptedSpellings', 'synonyms', 'examples', 'collocations', 'family', 'aliases', 'confusables', 'commonMisspellings') -contains $f) { $v = @($v | Where-Object { $null -ne $_ }) }
    if ($f -eq 'level' -or $f -eq 'awlSublist') { $v = [int]$v }
    $o[$f] = $v
  }
  $parts = foreach ($k in $o.Keys) {
    $val = $o[$k]
    $txt = if ($val -is [array] -or ($val -is [System.Collections.IEnumerable] -and -not ($val -is [string]))) { '[' + ((@($val) | ForEach-Object { ConvertTo-JsonValue $_ }) -join ',') + ']' } else { ConvertTo-JsonValue $val }
    (ConvertTo-JsonString $k) + ':' + $txt
  }
  return '{' + ($parts -join ',') + '}'
}

function Sort-Entries($list) {
  return @($list | Sort-Object @{ Expression = { $i = $script:TOPIC_ORDER.IndexOf([string]$_.topic); if ($i -lt 0) { 99 } else { $i } } }, @{ Expression = { ([string]$_.headword).ToLowerInvariant() } })
}

function Write-BankFile([string]$root, [int]$level, $entries) {
  $file = $script:BANK_FILES[$level]
  $lines = @(Sort-Entries $entries | ForEach-Object { ConvertTo-EntryJson $_ })
  $body = if ($lines.Count) { "[`n" + ($lines -join ",`n") + "`n]" } else { '[]' }
  $text = @"
// ===================================================================
// Word bank, level $level : $($script:LEVEL_NAMES[$level]) -- $($lines.Count) word families
// -------------------------------------------------------------------
// Data for js/wordbank.js. Written by tools/words-import.ps1 from
// word-bank.csv; edit the CSV (tools/words-export.ps1 makes it) or this
// file, then run tools/validate-words.ps1. One entry per line.
// ===================================================================
window.G = window.G || {};
G.BANK_$level =
/*BANK*/
$body
/*END*/;
"@
  [IO.File]::WriteAllText((Join-Path $root "js/data/$file"), ($text -replace "`r`n", "`n"), $script:utf8NoBom)
}

# ---------------- CSV (tools/words-export.ps1, tools/words-import.ps1) ----------------
# Lists sit in one cell joined with " | "; family cells read
# "analysis (n) | analytical (adj)"; the paraphrase is three columns.
$script:CSV_COLUMNS = @('id', 'headword', 'partOfSpeech', 'acceptedSpellings', 'thai', 'definition', 'synonyms', 'examples', 'collocations',
  'family', 'topic', 'level', 'source', 'awlSublist', 'awlHeadword', 'aliases', 'confusables', 'commonMisspellings', 'stress',
  'paraphraseSentence', 'paraphrasePhrase', 'paraphraseWord')
$script:LIST_FIELDS = @('acceptedSpellings', 'synonyms', 'examples', 'collocations', 'aliases', 'confusables', 'commonMisspellings')

function ConvertTo-CsvRow($e) {
  $o = [ordered]@{}
  foreach ($c in $script:CSV_COLUMNS) { $o[$c] = '' }
  foreach ($f in $script:FIELDS) {
    $p = $e.PSObject.Properties[$f]
    if (-not $p -or $null -eq $p.Value) { continue }
    $v = $p.Value
    if ($script:LIST_FIELDS -contains $f) { $o[$f] = (@($v) | Where-Object { $_ }) -join ' | ' }
    elseif ($f -eq 'family') { $o[$f] = (@($v) | Where-Object { $_ } | ForEach-Object { "$($_.word) ($($_.pos))" }) -join ' | ' }
    elseif ($f -eq 'paraphrase') { $o.paraphraseSentence = [string]$v.sentence; $o.paraphrasePhrase = [string]$v.phrase; $o.paraphraseWord = [string]$v.word }
    else { $o[$f] = [string]$v }
  }
  return [pscustomobject]$o
}

function ConvertFrom-CsvRow($r) {
  $cell = { param($n) $p = $r.PSObject.Properties[$n]; if ($p -and $null -ne $p.Value) { ([string]$p.Value).Trim() } else { '' } }
  $list = { param($n) @((& $cell $n) -split '\|' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
  $o = [ordered]@{}
  foreach ($f in $script:FIELDS) {
    switch ($f) {
      'family' {
        $o.family = @(& $list 'family' | ForEach-Object {
            if ($_ -notmatch '^(.+?)\s*\(([a-z]+)\)$') { throw "family item '$_' should look like 'analysis (n)'" }
            [pscustomobject][ordered]@{ word = $Matches[1].Trim(); pos = $Matches[2] }
          })
      }
      'paraphrase' {
        $s = & $cell 'paraphraseSentence'; $ph = & $cell 'paraphrasePhrase'; $w = & $cell 'paraphraseWord'
        if ($s -or $ph -or $w) { $o.paraphrase = [pscustomobject][ordered]@{ sentence = $s; phrase = $ph; word = $w } }
      }
      'level' { $v = & $cell 'level'; $o.level = if ($v -match '^\d+$') { [int]$v } else { $v } }
      'awlSublist' { $v = & $cell 'awlSublist'; if ($v) { $o.awlSublist = if ($v -match '^\d+$') { [int]$v } else { $v } } }
      default {
        if ($script:LIST_FIELDS -contains $f) { $o[$f] = & $list $f } else { $o[$f] = & $cell $f }
      }
    }
  }
  return [pscustomobject]$o
}

function Write-CsvFile([string]$path, $rows, [string[]]$columns) {
  $q = { param($s) '"' + ([string]$s).Replace('"', '""') + '"' }
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add((($columns | ForEach-Object { & $q $_ }) -join ','))
  foreach ($r in $rows) { $lines.Add((($columns | ForEach-Object { & $q $r.$_ }) -join ',')) }
  # UTF-8 with a BOM and CRLF: what Excel expects for Thai text
  [IO.File]::WriteAllText($path, (($lines -join "`r`n") + "`r`n"), (New-Object Text.UTF8Encoding $true))
}

# CSV text -> objects. Handles quoted cells with commas, quotes and line
# breaks; comma or semicolon separators; UTF-8 (with or without BOM) or
# the Thai Windows code page 874 that Excel's plain "CSV" uses on Thai
# Windows.
function Read-CsvFile([string]$path) {
  $bytes = [IO.File]::ReadAllBytes($path)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    $text = (New-Object Text.UTF8Encoding $false).GetString($bytes, 3, $bytes.Length - 3)
  } else {
    try { $text = (New-Object Text.UTF8Encoding($false, $true)).GetString($bytes) }
    catch { $text = [Text.Encoding]::GetEncoding(874).GetString($bytes) }
  }
  $firstLine = ($text -split "`n", 2)[0]
  $sep = if (($firstLine.Split(';').Count) -gt ($firstLine.Split(',').Count)) { ';' } else { ',' }
  $records = New-Object System.Collections.Generic.List[object]
  $cur = New-Object System.Collections.Generic.List[string]
  $sb = New-Object Text.StringBuilder
  $inQ = $false; $i = 0; $n = $text.Length
  while ($i -lt $n) {
    $ch = $text[$i]
    if ($inQ) {
      if ($ch -eq '"') { if ($i + 1 -lt $n -and $text[$i + 1] -eq '"') { [void]$sb.Append('"'); $i++ } else { $inQ = $false } }
      else { [void]$sb.Append($ch) }
    } elseif ($ch -eq '"') { $inQ = $true }
    elseif ($ch -eq $sep) { $cur.Add($sb.ToString()); [void]$sb.Clear() }
    elseif ($ch -eq "`n" -or $ch -eq "`r") {
      if ($ch -eq "`r" -and $i + 1 -lt $n -and $text[$i + 1] -eq "`n") { $i++ }
      $cur.Add($sb.ToString()); [void]$sb.Clear()
      $records.Add($cur.ToArray()); $cur = New-Object System.Collections.Generic.List[string]
    } else { [void]$sb.Append($ch) }
    $i++
  }
  if ($sb.Length -or $cur.Count) { $cur.Add($sb.ToString()); $records.Add($cur.ToArray()) }
  if (-not $records.Count) { return @() }
  $head = @($records[0] | ForEach-Object { $_.Trim() })
  $out = New-Object System.Collections.Generic.List[object]
  for ($k = 1; $k -lt $records.Count; $k++) {
    $rec = $records[$k]
    if ($rec.Count -eq 1 -and -not $rec[0].Trim()) { continue }
    $o = [ordered]@{}
    for ($c = 0; $c -lt $head.Count; $c++) { $o[$head[$c]] = if ($c -lt $rec.Count) { $rec[$c] } else { '' } }
    $out.Add([pscustomobject]$o)
  }
  return $out.ToArray()
}

function Write-ConfusablesFile([string]$root, $items) {
  $lines = @($items | Sort-Object { ([string]$_.headword).ToLowerInvariant() } | ForEach-Object {
      $o = [ordered]@{ headword = [string]$_.headword; partOfSpeech = [string]$_.partOfSpeech; thai = [string]$_.thai; definition = [string]$_.definition }
      ConvertTo-JsonValue $o
    })
  $body = if ($lines.Count) { "[`n" + ($lines -join ",`n") + "`n]" } else { '[]' }
  $text = @"
// ===================================================================
// Confusables lexicon: words the bank's entries are easily mixed up with
// (adopt for adapt, compliment for complement...) that are not target
// words themselves. Shown when a player picks one by mistake; used only
// as distractors, never as a word to learn. Checked by
// tools/validate-words.ps1.
// ===================================================================
window.G = window.G || {};
G.CONFUSABLES =
/*CONFUSABLES*/
$body
/*END*/;
"@
  [IO.File]::WriteAllText((Join-Path $root 'js/data/confusables.js'), ($text -replace "`r`n", "`n"), $script:utf8NoBom)
}
