# ===================================================================
# Word bank -> CSV, for editing in Excel or Google Sheets.
#
#   powershell -ExecutionPolicy Bypass -File tools\words-export.ps1
#
# Writes word-bank.csv (one row per word family) and
# word-bank-confusables.csv (the look-alike words used only as
# distractors) in the project folder, as UTF-8 with a BOM so Excel
# shows the Thai correctly. Lists inside a cell are joined with " | ";
# a family cell reads "analysis (n) | analytical (adj)". Edit, save as
# CSV (in Excel: "CSV UTF-8"), then run tools\words-import.ps1.
# ===================================================================
param([string]$Out = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
. (Join-Path $root 'tools\wordbank-lib.ps1')
if (-not $Out) { $Out = $root }

$rows = New-Object System.Collections.Generic.List[object]
foreach ($lv in 1, 2, 3) {
  foreach ($e in (Read-DataBlock (Join-Path $root ('js/data/' + $BANK_FILES[$lv])) 'BANK')) { $rows.Add((ConvertTo-CsvRow $e)) }
}
$conf = @(Read-DataBlock (Join-Path $root 'js/data/confusables.js') 'CONFUSABLES' | ForEach-Object {
    [pscustomobject][ordered]@{ headword = [string]$_.headword; partOfSpeech = [string]$_.partOfSpeech; thai = [string]$_.thai; definition = [string]$_.definition }
  })

$bank = Join-Path $Out 'word-bank.csv'
$lex = Join-Path $Out 'word-bank-confusables.csv'
Write-CsvFile $bank $rows $CSV_COLUMNS
Write-CsvFile $lex $conf @('headword', 'partOfSpeech', 'thai', 'definition')
"Exported $($rows.Count) word families -> $bank"
"Exported $($conf.Count) confusables -> $lex"
