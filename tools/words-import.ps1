# ===================================================================
# CSV -> word bank. The reverse of tools\words-export.ps1.
#
#   powershell -ExecutionPolicy Bypass -File tools\words-import.ps1
#
# Reads word-bank.csv and word-bank-confusables.csv from the project
# folder, rewrites js/data/bank_school.js, bank_hospital.js,
# bank_bunker.js and confusables.js (the files the game loads), then
# runs tools\validate-words.ps1. The "level" column (1 School,
# 2 Hospital, 3 Bunker) decides which file a row goes to. Never change
# an "id": saved progress is stored under it.
#
# Accepts CSV saved as UTF-8 (Excel "CSV UTF-8", Google Sheets) or as
# the Thai Windows code page (Excel "CSV (Comma delimited)" on Thai
# Windows), with comma or semicolon separators.
# ===================================================================
param([string]$In = '', [switch]$NoValidate)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
. (Join-Path $root 'tools\wordbank-lib.ps1')
if (-not $In) { $In = $root }

$bankRows = Read-CsvFile (Join-Path $In 'word-bank.csv')
$lexPath = Join-Path $In 'word-bank-confusables.csv'
$lexRows = if (Test-Path $lexPath) { Read-CsvFile $lexPath } else { @() }

$entries = New-Object System.Collections.Generic.List[object]
$line = 1
foreach ($r in $bankRows) {
  $line++
  if (-not ([string]$r.id).Trim() -and -not ([string]$r.headword).Trim()) { continue }   # blank row
  try { $entries.Add((ConvertFrom-CsvRow $r)) } catch { throw "word-bank.csv row $line : $($_.Exception.Message)" }
}
$byLevel = @{ 1 = @(); 2 = @(); 3 = @() }
foreach ($e in $entries) {
  $lv = [int]$e.level
  if (-not $byLevel.ContainsKey($lv)) { throw "id '$($e.id)': level must be 1, 2 or 3 (found '$($e.level)')" }
  $byLevel[$lv] += $e
}
foreach ($lv in 1, 2, 3) { Write-BankFile $root $lv $byLevel[$lv] }
$conf = @($lexRows | Where-Object { ([string]$_.headword).Trim() } | ForEach-Object {
    [pscustomobject]@{ headword = ([string]$_.headword).Trim(); partOfSpeech = ([string]$_.partOfSpeech).Trim(); thai = ([string]$_.thai).Trim(); definition = ([string]$_.definition).Trim() }
  })
Write-ConfusablesFile $root $conf
"Imported $($entries.Count) word families ($($byLevel[1].Count) / $($byLevel[2].Count) / $($byLevel[3].Count)) and $($conf.Count) confusables"
if (-not $NoValidate) {
  & (Join-Path $root 'tools\validate-words.ps1')
  exit $LASTEXITCODE
}
