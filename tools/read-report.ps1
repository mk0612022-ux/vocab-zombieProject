param([Parameter(Mandatory = $true)][string]$Path, [string]$Shot = "", [int]$Lines = 20)
# Dev-only (not shipped). Reads a player's .vzreport (js/bugreport.js) and prints
# what matters first: what they said, the version and the device, the frame
# rates, where the game was, every error with the top of its stack, then the
# last log lines and events. -Shot <file.jpg> writes the screenshot out, -Lines
# how many log lines and events.
$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$text = [IO.File]::ReadAllText((Resolve-Path $Path), $utf8)
# (the picture apart: it is most of the file, and PowerShell 5.1 parses JSON slowly)
$m = [regex]::Match($text, '"screenshot":"(data:image/jpeg;base64,)([^"]*)"')
$picture = if ($m.Success) { $m.Groups[2].Value } else { "" }
if ($m.Success) { $text = $text.Remove($m.Index, $m.Length).Insert($m.Index, '"screenshot":"yes"') }
$r = $text | ConvertFrom-Json
if ($r.app -ne "vocab-zombie" -or $r.kind -ne "report") { throw "not a Vocab Zombie report: $Path" }

function Head([string]$t) { ""; "== $t" }
$f = $r.form; $v = $r.version; $d = $r.device; $x = $r.graphics; $g = $r.game
"Report of $($r.at) (local: $($r.local))"
Head "what the player said"
"kind:  " + $(if ($f.category) { $f.category } else { "-" })
"doing: " + $(if ($f.doing) { $f.doing } else { "-" })
"text:  " + $(if ($f.text) { $f.text } else { "-" })
if ($r.uid) { "uid:   $($r.uid)" }
Head "version and device"
"$($v.version) build $($v.build) commit $($v.commit) ($($v.mode))"
"$($d.ua)"
"$($d.width)x$($d.height) @$($d.dpr), screen $($d.screen), $($d.orientation), input $($d.input), online $($d.online)"
Head "graphics"
"$($x.quality), cap $($x.fpsCap), render scale $($x.renderScale), GPU $($x.gpu)"
"FPS: $($x.fps.avg) avg, $($x.fps.min) min, $($x.fps.low1) 1% low, $($x.fps.slow) slow of $($x.fps.frames) frames"
"calls $($x.calls), triangles $($x.triangles), geometries $($x.geometries), textures $($x.textures), programs $($x.programs)"
$worst = @($x.fps.seconds | ForEach-Object { , $_ } | Sort-Object { $_[0] } | Select-Object -First 3 | ForEach-Object { "$($_[0]) fps (worst frame $($_[1]) fps, $($_[2]) slow)" })
if ($worst.Count) { "worst seconds: " + ($worst -join "; ") }
Head "sound"
"$($r.audio.state), playing $(if ($r.audio.playing) { $r.audio.playing.total } else { 0 })"
Head "game"
"$($g.state), mode $($g.mode), paused $($g.paused), screen $($g.screen), windows [$(@($g.windows) -join ', ')]"
if ($null -ne $g.level) {
  "level $($g.level), wave $($g.wave), floor $($g.floor), $($g.zombies) zombies: $($g.kinds | ConvertTo-Json -Compress)"
  $p = $g.player; $w = $g.weapon
  "HP $($p.hp)/$($p.maxHp), stamina $($p.stamina), money $($p.money), at $($p.x), $($p.y), $($p.z)"
  "weapon $($w.id): $($w.state) $($w.stateTime) s, $($w.mag)/$($w.reserve), slots $(@($w.slots) -join ', ')"
  if ($g.word) { "word: $($g.word.id) ($($g.word.clue))" }
  if ($g.question) { "question: $($g.question.word) ($($g.question.type)), $($g.question.timeLeft) s left" }
}
$errors = @($r.errors)
Head "errors ($($errors.Count))"
foreach ($e in $errors) {
  "[$($e.kind)] $($e.message)$(if ($e.count -gt 1) { " (x$($e.count))" })$(if ($e.where) { " at $($e.where)" })"
  @("$($e.stack)" -split "`n" | Select-Object -First 6) | ForEach-Object { if ($_) { "    $_" } }
}
Head "last log lines"
@($r.logs) | Select-Object -Last $Lines | ForEach-Object { "$($_.level): $($_.text)" }
Head "last events"
@($r.events) | Select-Object -Last $Lines | ForEach-Object { $_.type + " " + ($_.p | ConvertTo-Json -Compress) }
Head "screenshot"
if (-not $picture) { "none" }
elseif ($Shot) { [IO.File]::WriteAllBytes($Shot, [Convert]::FromBase64String($picture)); "written to $Shot" }
else { "attached ($([int]($picture.Length * 3 / 4 / 1024)) KB): -Shot <file.jpg> writes it out" }
