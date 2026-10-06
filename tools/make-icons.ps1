# Dev-only: draws the app icons (A4) into public/icons/ -- a blocky zombie head
# on the lobby's dark background, the word "VOCAB" under it. Everything that
# matters sits inside the middle 80%, so the "maskable" crop on Android
# (circle, squircle...) never cuts into it.
#   powershell -ExecutionPolicy Bypass -File .\tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'public\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function Draw-Icon([int]$S, [string]$file) {
  $bmp = New-Object System.Drawing.Bitmap $S, $S
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'None'; $g.InterpolationMode = 'NearestNeighbor'; $g.TextRenderingHint = 'AntiAliasGridFit'
  # background: night gradient
  $rect = New-Object System.Drawing.Rectangle 0, 0, $S, $S
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 25, 22, 64)), ([System.Drawing.Color]::FromArgb(255, 5, 7, 12)), 90
  $g.FillRectangle($bg, $rect)
  # a moon behind, top right
  $moon = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 200, 214, 255))
  $g.FillEllipse($moon, [int]($S * 0.56), [int]($S * 0.12), [int]($S * 0.3), [int]($S * 0.3))
  $u = $S / 16.0
  function Box($c, $x, $y, $w, $h) { $b = New-Object System.Drawing.SolidBrush $c; $g.FillRectangle($b, [int]($x * $u), [int]($y * $u), [int][Math]::Ceiling($w * $u), [int][Math]::Ceiling($h * $u)); $b.Dispose() }
  $skin = [System.Drawing.Color]::FromArgb(255, 122, 168, 92); $skinD = [System.Drawing.Color]::FromArgb(255, 88, 128, 66)
  $hair = [System.Drawing.Color]::FromArgb(255, 40, 34, 28); $eye = [System.Drawing.Color]::FromArgb(255, 18, 18, 20)
  $red = [System.Drawing.Color]::FromArgb(255, 230, 40, 40); $mouth = [System.Drawing.Color]::FromArgb(255, 60, 20, 24)
  $teeth = [System.Drawing.Color]::FromArgb(255, 230, 222, 196)
  # the head (inside the middle 80%: 1.6..14.4 of 16)
  Box $skin 3.5 3.2 9 8.6
  Box $skinD 3.5 10.4 9 1.4
  Box $hair 3.5 3.2 9 1.8
  Box $hair 3.5 5.0 1.4 1.2
  Box $hair 10.4 5.0 2.1 0.8
  # eyes, one drooping
  Box $eye 5.0 6.4 2.2 1.8; Box $red 5.8 7.0 0.8 0.8
  Box $eye 8.8 6.8 2.2 1.6; Box $red 9.6 7.3 0.8 0.7
  # mouth with teeth
  Box $mouth 5.6 9.2 4.8 1.4
  Box $teeth 6.0 9.2 0.7 0.6; Box $teeth 7.4 9.2 0.7 0.6; Box $teeth 8.8 9.2 0.7 0.6
  # a scar
  Box $skinD 10.6 8.6 1.2 0.4
  # the word
  $fs = [single]($S * 0.11)
  $font = New-Object System.Drawing.Font 'Segoe UI Black', $fs, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'
  $green = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 107, 255, 122))
  $g.DrawString('VOCAB', $font, $green, (New-Object System.Drawing.RectangleF 0, ([single]($S * 0.745)), $S, ([single]($S * 0.16))), $fmt)
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Draw-Icon 512 'icon-512.png'
Draw-Icon 192 'icon-192.png'
Draw-Icon 180 'apple-touch-icon.png'
Get-ChildItem $out | Select-Object Name, Length | Format-Table -AutoSize | Out-String
