# ===================================================================
# validate-words (newer series 3, round 1, A6): checks the word bank
# -------------------------------------------------------------------
# Reads public/js/data/bank_school.js, bank_hospital.js, bank_bunker.js (the
# entries between /*BANK*/ and /*END*/) and public/js/data/confusables.js, and
# reports every problem it finds:
#   - required fields present and well formed; ids unique
#   - a word family in one place only: no form (headword, accepted
#     spelling, family member, merged old id) shared by two entries, so
#     analyse and analysis can never sit in two levels
#   - the definition uses none of the word's own forms; every example and
#     every collocation uses at least one
#   - acceptedSpellings includes the headword; English fields hold no Thai
#     letters; the Thai is there, and no two targets in one level have
#     exactly the same Thai
#   - every confusable is in the bank or in the confusables lexicon
#   - topic from the fixed list; awlSublist 1-10; the AWL complete: all
#     570 families, each in the sublist the official list gives it
#     (Coxhead's AWL, Victoria University of Wellington -- checked against
#     the published sublist file, 2026-09-30)
# and prints the counts by level and topic.
#
#   powershell -ExecutionPolicy Bypass -File .\tools\validate-words.ps1
#   ... -Partial     while the bank is still being built: skips the
#                    "AWL complete" and level-size checks
# Exit code 0 when clean, 1 when anything is wrong.
# ===================================================================
param([switch]$Partial, [switch]$Quiet)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = [Text.Encoding]::UTF8

$TOPICS = @('Education', 'Health', 'Environment', 'Technology', 'Science & Research', 'Government & Law', 'Crime & Security',
  'Work & Economy', 'Society & Culture', 'Media & Communication', 'Urban Life & Transport', 'General Academic')
$LEVELS = @{ 1 = 'bank_school.js'; 2 = 'bank_hospital.js'; 3 = 'bank_bunker.js' }
$POS = @('n', 'v', 'adj', 'adv', 'prep', 'conj', 'det', 'pron', 'phrase')

# The AWL's 570 families by sublist (headwords as the official list gives them)
$AWL_REF = @'
1 analyse approach area assess assume authority available benefit concept consist constitute context contract create data define derive distribute economy environment establish estimate evident export factor finance formula function identify income indicate individual interpret involve issue labour legal legislate major method occur percent period policy principle proceed process require research respond role section sector significant similar source specific structure theory vary
2 achieve acquire administrate affect appropriate aspect assist category chapter commission community complex compute conclude conduct consequent construct consume credit culture design distinct element equate evaluate feature final focus impact injure institute invest item journal maintain normal obtain participate perceive positive potential previous primary purchase range region regulate relevant reside resource restrict secure seek select site strategy survey text tradition transfer
3 alternative circumstance comment compensate component consent considerable constant constrain contribute convene coordinate core corporate correspond criteria deduce demonstrate document dominate emphasis ensure exclude framework fund illustrate immigrate imply initial instance interact justify layer link locate maximise minor negate outcome partner philosophy physical proportion publish react register rely remove scheme sequence sex shift specify sufficient task technical technique technology valid volume
4 access adequate annual apparent approximate attitude attribute civil code commit communicate concentrate confer contrast cycle debate despite dimension domestic emerge error ethnic goal grant hence hypothesis implement implicate impose integrate internal investigate job label mechanism obvious occupy option output overall parallel parameter phase predict principal prior professional project promote regime resolve retain series statistic status stress subsequent sum summary undertake
5 academy adjust alter amend aware capacity challenge clause compound conflict consult contact decline discrete draft enable energy enforce entity equivalent evolve expand expose external facilitate fundamental generate generation image liberal licence logic margin medical mental modify monitor network notion objective orient perspective precise prime psychology pursue ratio reject revenue stable style substitute sustain symbol target transit trend version welfare whereas
6 abstract accurate acknowledge aggregate allocate assign attach author bond brief capable cite cooperate discriminate display diverse domain edit enhance estate exceed expert explicit federal fee flexible furthermore gender ignorant incentive incidence incorporate index inhibit initiate input instruct intelligent interval lecture migrate minimum ministry motive neutral nevertheless overseas precede presume rational recover reveal scope subsidy tape trace transform transport underlie utilise
7 adapt adult advocate aid channel chemical classic comprehensive comprise confirm contrary convert couple decade definite deny differentiate dispose dynamic eliminate empirical equip extract file finite foundation globe grade guarantee hierarchy identical ideology infer innovate insert intervene isolate media mode paradigm phenomenon priority prohibit publication quote release reverse simulate sole somewhat submit successor survive thesis topic transmit ultimate unique visible voluntary
8 abandon accompany accumulate ambiguous append appreciate arbitrary automate bias chart clarify commodity complement conform contemporary contradict crucial currency denote detect deviate displace drama eventual exhibit exploit fluctuate guideline highlight implicit induce inevitable infrastructure inspect intense manipulate minimise nuclear offset paragraph plus practitioner predominant prospect radical random reinforce restore revise schedule tense terminate theme thereby uniform vehicle via virtual visual widespread
9 accommodate analogy anticipate assure attain behalf bulk cease coherent coincide commence compatible concurrent confine controversy converse device devote diminish distort duration erode ethic format found inherent insight integral intermediate manual mature mediate medium military minimal mutual norm overlap passive portion preliminary protocol qualitative refine relax restrain revolution rigid route scenario sphere subordinate supplement suspend team temporary trigger unify violate vision
10 adjacent albeit assemble collapse colleague compile conceive convince depress encounter enormous forthcoming incline integrity intrinsic invoke levy likewise nonetheless notwithstanding odd ongoing panel persist pose reluctance so-called straightforward undergo whereby
'@
$awlRef = @{}
foreach ($line in ($AWL_REF -split "`n")) {
  $p = $line.Trim() -split ' '
  if ($p.Count -lt 2) { continue }
  $sub = [int]$p[0]
  for ($i = 1; $i -lt $p.Count; $i++) { $awlRef[$p[$i]] = $sub }
}

$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]
function Err([string]$m) { $errors.Add($m) }
function Warn([string]$m) { $warnings.Add($m) }

function Read-Block([string]$path, [string]$marker) {
  $t = [IO.File]::ReadAllText($path, $utf8)
  $open = '/*' + $marker + '*/'
  $a = $t.IndexOf($open); $b = $t.IndexOf('/*END*/')
  if ($a -lt 0 -or $b -lt $a) { throw "$path : markers $open ... /*END*/ not found" }
  $json = $t.Substring($a + $open.Length, $b - $a - $open.Length).Trim()
  if (-not $json -or $json -eq '[]') { return @() }
  # PowerShell 5.1 passes a parsed JSON array on as one object: unroll it
  return @($json | ConvertFrom-Json | ForEach-Object { $_ })
}

# a word and its regular inflections: analyse -> analyses, analysed,
# analysing; study -> studies; commit -> committed
function Get-Inflections([string]$f) {
  $out = New-Object System.Collections.Generic.HashSet[string]
  foreach ($suf in '', 's', 'es', 'd', 'ed', 'ing', "'s", 'er', 'ers') { [void]$out.Add($f + $suf) }
  if ($f.EndsWith('e')) { $s = $f.Substring(0, $f.Length - 1); [void]$out.Add($s + 'ing'); [void]$out.Add($s + 'ed') }
  if ($f.EndsWith('y')) { $s = $f.Substring(0, $f.Length - 1); [void]$out.Add($s + 'ies'); [void]$out.Add($s + 'ied') }
  if ($f -match '(?:[^aeiou]|qu)[aeiou][bdgklmnprt]$') { $c = [string]$f[$f.Length - 1]; foreach ($suf in 'ed', 'ing', 'er') { [void]$out.Add($f + $c + $suf) } }
  return $out
}
function Get-Tokens([string]$text) {
  # a hyphenated word counts whole and by its parts: male-dominated -> dominated
  return @([regex]::Matches($text.ToLowerInvariant(), "[a-z]+(?:[-'][a-z]+)*") | ForEach-Object {
      $_.Value
      if ($_.Value.Contains('-')) { $_.Value.Split('-') }
    })
}
# which of the forms the text uses (as a word, or a multi-word form as a phrase)
function Find-Form([string]$text, $inflSet, $multi) {
  foreach ($t in (Get-Tokens $text)) { if ($inflSet.Contains($t)) { return $t } }
  $low = ' ' + ($text.ToLowerInvariant() -replace "[^a-z' -]", ' ') + ' '
  foreach ($m in $multi) { if ($low.Contains(' ' + $m + ' ')) { return $m } }
  return $null
}
$THAI = '[\u0E00-\u0E7F]'

# ---------------- read ----------------
$entries = New-Object System.Collections.Generic.List[object]
foreach ($lv in 1, 2, 3) {
  $path = Join-Path $root ('public/js/data/' + $LEVELS[$lv])
  if (-not (Test-Path $path)) { if (-not $Partial) { Err "missing file public/js/data/$($LEVELS[$lv])" }; continue }
  foreach ($e in (Read-Block $path 'BANK')) {
    $e | Add-Member -NotePropertyName '__file' -NotePropertyValue $LEVELS[$lv] -Force
    $e | Add-Member -NotePropertyName '__lv' -NotePropertyValue $lv -Force
    $entries.Add($e)
  }
}
$confPath = Join-Path $root 'public/js/data/confusables.js'
$lexicon = @()
if (Test-Path $confPath) { $lexicon = @(Read-Block $confPath 'CONFUSABLES') } elseif (-not $Partial) { Err 'missing file public/js/data/confusables.js' }

# ---------------- each entry ----------------
$ids = @{}
$formOwner = @{}                 # form -> id
$thaiByLevel = @{ 1 = @{}; 2 = @{}; 3 = @{} }
foreach ($e in $entries) {
  $id = [string]$e.id
  $where = "[$($e.__file)] $id"
  foreach ($f in 'id', 'headword', 'partOfSpeech', 'thai', 'definition', 'topic', 'source') {
    if (-not ($e.PSObject.Properties[$f]) -or [string]::IsNullOrWhiteSpace([string]$e.$f)) { Err "$where : '$f' is missing" }
  }
  foreach ($f in 'acceptedSpellings', 'synonyms', 'examples', 'collocations', 'family') {
    if (-not ($e.PSObject.Properties[$f]) -or $null -eq $e.$f) { Err "$where : '$f' is missing" }
  }
  if (-not $id) { continue }
  if ($id -notmatch '^[a-z][a-z0-9-]*$') { Err "$where : id must be lower-case letters, digits and hyphens" }
  if ($ids.ContainsKey($id)) { Err "$where : id also used in $($ids[$id])" } else { $ids[$id] = $e.__file }
  if ([int]$e.level -ne $e.__lv) { Err "$where : level is $($e.level) but it is in $($e.__file)" }
  $hw = ([string]$e.headword).ToLowerInvariant()
  if ($POS -notcontains [string]$e.partOfSpeech) { Err "$where : partOfSpeech '$($e.partOfSpeech)' (use n, v, adj, adv, prep, conj, det, pron or phrase)" }
  if ($TOPICS -cnotcontains [string]$e.topic) { Err "$where : topic '$($e.topic)' is not one of the twelve" }
  if (@('AWL', 'Topic') -cnotcontains [string]$e.source) { Err "$where : source must be AWL or Topic" }

  $acc = @($e.acceptedSpellings | ForEach-Object { ([string]$_).ToLowerInvariant() })
  if ($acc -notcontains $hw) { Err "$where : acceptedSpellings does not include the headword" }
  $syn = @($e.synonyms); if ($syn.Count -lt 2 -or $syn.Count -gt 3) { Err "$where : synonyms: $($syn.Count) (2-3)" }
  $ex = @($e.examples); if ($ex.Count -ne 2) { Err "$where : examples: $($ex.Count) (2)" }
  $col = @($e.collocations); if ($col.Count -lt 2 -or $col.Count -gt 4) { Err "$where : collocations: $($col.Count) (2-4)" }
  foreach ($f in 'acceptedSpellings', 'synonyms', 'examples', 'collocations', 'aliases', 'confusables', 'commonMisspellings') {
    # word-bank.csv joins list items with " | "
    foreach ($x in @($e.$f)) { if (([string]$x).Contains('|')) { Err "$where : '$f' item contains '|': $x" } }
  }
  $fam = @($e.family)
  foreach ($m in $fam) {
    if (-not $m.word -or -not $m.pos) { Err "$where : a family member needs word and pos" }
    elseif ($POS -notcontains [string]$m.pos) { Err "$where : family '$($m.word)' pos '$($m.pos)'" }
  }

  # every form of the family, and its inflections
  $forms = New-Object System.Collections.Generic.HashSet[string]
  [void]$forms.Add($hw)
  foreach ($a in $acc) { [void]$forms.Add($a) }
  foreach ($m in $fam) { if ($m.word) { [void]$forms.Add(([string]$m.word).ToLowerInvariant()) } }
  foreach ($a in @($e.aliases)) { if ($a) { [void]$forms.Add(([string]$a).ToLowerInvariant()) } }
  if ($e.awlHeadword) { [void]$forms.Add(([string]$e.awlHeadword).ToLowerInvariant()) }
  $infl = New-Object System.Collections.Generic.HashSet[string]
  $multi = @()
  foreach ($f in $forms) {
    if ($f -match ' ') { $multi += $f } else { foreach ($x in (Get-Inflections $f)) { [void]$infl.Add($x) } }
    if ($formOwner.ContainsKey($f) -and $formOwner[$f] -ne $id) { Err "$where : '$f' is also a form of '$($formOwner[$f])' -- one family, one entry" }
    else { $formOwner[$f] = $id }
  }
  $e | Add-Member -NotePropertyName '__infl' -NotePropertyValue $infl -Force
  $e | Add-Member -NotePropertyName '__multi' -NotePropertyValue $multi -Force

  $hit = Find-Form ([string]$e.definition) $infl $multi
  if ($hit) { Err "$where : the definition uses '$hit' (a form of the word itself)" }
  foreach ($x in $ex) { if (-not (Find-Form ([string]$x) $infl $multi)) { Err "$where : example has no form of the word: $x" } }
  foreach ($x in $col) { if (-not (Find-Form ([string]$x) $infl $multi)) { Err "$where : collocation has no form of the word: $x" } }

  # English fields: no Thai letters
  $eng = @([string]$e.headword, [string]$e.definition, [string]$e.stress) + $acc + $syn + $ex + $col + @($fam | ForEach-Object { $_.word }) + @($e.confusables) + @($e.commonMisspellings)
  if ($e.paraphrase) { $eng += @([string]$e.paraphrase.sentence, [string]$e.paraphrase.phrase, [string]$e.paraphrase.word) }
  foreach ($s in $eng) { if ($s -and $s -match $THAI) { Err "$where : Thai letters in an English field: $s" } }
  # the Thai: present, at most two meanings, not the same as another target in the level
  $th = ([string]$e.thai).Trim() -replace '\s+', ' '
  if ($th -notmatch $THAI) { Err "$where : thai has no Thai letters" }
  if (@($th -split '\s*[/;,]\s*' | Where-Object { $_ }).Count -gt 2) { Err "$where : thai gives more than two meanings: $th" }
  $tl = $thaiByLevel[$e.__lv]
  if ($tl.ContainsKey($th)) { Err "$where : the same Thai as '$($tl[$th])' in this level: $th" } else { $tl[$th] = $id }

  if ($e.source -eq 'AWL') {
    $sub = $e.awlSublist
    if ($null -eq $sub -or [int]$sub -lt 1 -or [int]$sub -gt 10) { Err "$where : awlSublist must be 1-10 for an AWL word" }
    if (-not $e.awlHeadword) { Err "$where : awlHeadword missing (the AWL family this entry is)" }
    elseif (-not $awlRef.ContainsKey([string]$e.awlHeadword)) { Err "$where : '$($e.awlHeadword)' is not an AWL headword" }
    elseif ($awlRef[[string]$e.awlHeadword] -ne [int]$sub) { Err "$where : '$($e.awlHeadword)' is in AWL sublist $($awlRef[[string]$e.awlHeadword]), not $sub" }
  } elseif ($e.awlSublist) { Err "$where : awlSublist is only for AWL words" }

  if ($e.stress) {
    $s = ([string]$e.stress) -replace '-', ''
    if ($s.ToLowerInvariant() -ne ($hw -replace '[- ]', '')) { Err "$where : stress '$($e.stress)' does not spell the headword" }
    if (([string]$e.stress) -cnotmatch '[A-Z]') { Err "$where : stress marks no syllable in capitals" }
  }
  foreach ($m in @($e.commonMisspellings)) { if ($m -and $acc -contains ([string]$m).ToLowerInvariant()) { Err "$where : '$m' is listed both as accepted and as a misspelling" } }
  if ($e.paraphrase) {
    $p = $e.paraphrase
    if (-not $p.sentence -or -not $p.phrase -or -not $p.word) { Err "$where : paraphrase needs sentence, phrase and word" }
    elseif (-not ([string]$p.sentence).Contains([string]$p.phrase)) { Err "$where : paraphrase phrase is not in its sentence" }
    elseif (-not (Find-Form ([string]$p.word) $infl $multi)) { Err "$where : paraphrase word '$($p.word)' is not a form of the word" }
  }
  if ($hw -match '(iz(e|es|ed|ing|ation)|yze)$' -and $acc -notcontains ($hw -replace 'iz', 'is' -replace 'yz', 'ys') -and @('size', 'seize', 'prize', 'capsize') -notcontains $hw) {
    Warn "$where : headword '$hw' looks American -- British spelling first"
  }
}

# ---------------- confusables ----------------
$lexHeads = @{}
foreach ($c in $lexicon) {
  $h = ([string]$c.headword).ToLowerInvariant()
  if (-not $h -or -not $c.thai -or -not $c.definition) { Err "[confusables.js] '$h' needs headword, thai and definition" }
  if ($formOwner.ContainsKey($h)) { Err "[confusables.js] '$h' is already in the bank (a form of '$($formOwner[$h])') -- keep it in one place" }
  if ($lexHeads.ContainsKey($h)) { Err "[confusables.js] '$h' twice" }
  $lexHeads[$h] = $true
  if (([string]$c.headword + [string]$c.definition) -match $THAI) { Err "[confusables.js] Thai letters in '$h'" }
}
foreach ($e in $entries) {
  foreach ($c in @($e.confusables)) {
    if (-not $c) { continue }
    $w = ([string]$c).ToLowerInvariant()
    if ($e.__infl.Contains($w)) { Err "[$($e.__file)] $($e.id) : confusable '$c' is a form of the word itself" }
    elseif (-not $formOwner.ContainsKey($w) -and -not $lexHeads.ContainsKey($w)) {
      # a partial bank may not have reached the word yet
      $m = "[$($e.__file)] $($e.id) : confusable '$c' is in neither the bank nor confusables.js"
      if ($Partial) { Warn $m } else { Err $m }
    }
  }
}

# ---------------- the whole bank ----------------
$awl = @($entries | Where-Object { $_.source -eq 'AWL' })
$awlHeads = @{}
foreach ($e in $awl) { if ($e.awlHeadword) { if ($awlHeads.ContainsKey([string]$e.awlHeadword)) { Err "AWL family '$($e.awlHeadword)' appears twice ($($awlHeads[[string]$e.awlHeadword]), $($e.id))" } else { $awlHeads[[string]$e.awlHeadword] = $e.id } } }
if (-not $Partial) {
  $missing = @($awlRef.Keys | Where-Object { -not $awlHeads.ContainsKey($_) } | Sort-Object)
  if ($missing.Count) { Err "AWL incomplete: $($missing.Count) families missing: $($missing[0..([Math]::Min(29, $missing.Count - 1))] -join ', ')$(if ($missing.Count -gt 30) { ' ...' })" }
  foreach ($lv in 1, 2, 3) {
    $n = @($entries | Where-Object { $_.__lv -eq $lv }).Count
    if ($n -lt 240 -or $n -gt 330) { Err "level $lv has $n entries (expected about 250-300)" }
  }
}

# ---------------- report ----------------
if (-not $Quiet) {
  "Word bank: $($entries.Count) entries, $($lexicon.Count) confusables"
  foreach ($lv in 1, 2, 3) {
    $in = @($entries | Where-Object { $_.__lv -eq $lv })
    $a = @($in | Where-Object { $_.source -eq 'AWL' }).Count
    "  level $lv ($($LEVELS[$lv])): $($in.Count)  (AWL $a, topic $($in.Count - $a))"
    $in | Group-Object topic | Sort-Object Name | ForEach-Object { "      {0,-24} {1,4}" -f $_.Name, $_.Count }
  }
  $bySub = $awl | Group-Object awlSublist | Sort-Object { [int]$_.Name }
  "  AWL families: $($awlHeads.Count) of 570 -- by sublist: " + (($bySub | ForEach-Object { "$($_.Name):$($_.Count)" }) -join '  ')
  foreach ($w in $warnings) { "  WARNING $w" }
}
if ($errors.Count) {
  foreach ($m in $errors) { "  ERROR $m" }
  "FAILED: $($errors.Count) problem(s)"
  exit 1
}
"OK: every check passed$(if ($Partial) { ' (partial: completeness not checked)' })"
exit 0
