param([int]$Port = 9335, [int]$W = 1280, [int]$H = 720, [string]$Url = "about:blank", [string]$Angle = "d3d11")
# Dev-only (not shipped). A headless Edge with its own profile, driven over the
# DevTools protocol by cdp.ps1 -- what every test run here uses (no Node on this
# machine). The profile lives beside the repo, in ..\vocab-zombieProject-files,
# so a cleared temp folder does not lose it; only that profile's processes are
# stopped, never the user's own Edge. -Angle swiftshader: software WebGL, for when
# the GPU process hangs (getContext never returns, the page stops answering with
# no CPU in use) -- slower, but it always comes up.
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$files = Join-Path (Split-Path -Parent $repo) "vocab-zombieProject-files"
$profileDir = Join-Path $files "edge-vz"
$exe = @("C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe", "C:\Program Files\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exe) { throw "msedge.exe not found" }
Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*vocab-zombieProject-files\edge-vz*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 1500
$edgeArgs = @("--headless=new", "--remote-debugging-port=$Port", "--user-data-dir=$profileDir", "--window-size=$W,$H",
  "--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=$Angle", "--no-first-run", "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", $Url)
if ($Angle -eq "swiftshader") { $edgeArgs = @("--enable-unsafe-swiftshader") + $edgeArgs }
Start-Process -FilePath $exe -ArgumentList $edgeArgs -WindowStyle Hidden
$t0 = Get-Date
do { try { $j = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 300 } } while (((Get-Date) - $t0).TotalSeconds -lt 60)
if ($j) { "edge up: " + $j.Browser } else { "edge did not start" }
