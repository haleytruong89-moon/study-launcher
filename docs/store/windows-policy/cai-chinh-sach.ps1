# Study Launcher - Windows browser policies for a child's laptop (docs/SETUP.md part C, step C7).
#
# What it does (machine-wide, HKLM, applies to every Windows account on this laptop):
#   1. Force-installs the Study Launcher extension from the Chrome Web Store (Chrome) and from
#      Edge Add-ons (Edge). Force-installed extensions cannot be removed or turned off by the child.
#   2. Turns off Incognito (Chrome) / InPrivate (Edge), Guest mode, adding new browser profiles,
#      and Developer Tools (also used to tamper with extensions).
#
# How to run (parent, Windows administrator account):
#   - Start menu > type "PowerShell" > right-click "Windows PowerShell" > "Run as administrator"
#   - cd to the folder holding this file, then:
#       powershell -ExecutionPolicy Bypass -File .\cai-chinh-sach.ps1
#   - Paste the two extension IDs when asked (32 letters a-p, from the store pages).
#     Leave one empty to skip that browser.
#   - Close ALL Chrome / Edge windows, open again, check chrome://policy and edge://policy.
# Undo: go-chinh-sach.ps1 in the same folder.
#
# Messages are plain ASCII (Vietnamese without accents) so Windows PowerShell 5.1 shows them
# correctly whatever the file encoding.

param(
  [string]$ChromeId = "",
  [string]$EdgeId = ""
)

$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "Can chay PowerShell bang 'Run as administrator'. Dung lai, chua thay doi gi." -ForegroundColor Red
  exit 1
}

# Official update URLs: Chrome Web Store / Microsoft Edge Add-ons.
$ChromeUpdateUrl = "https://clients2.google.com/service/update2/crx"
$EdgeUpdateUrl = "https://edge.microsoft.com/extensionwebstorebase/v1/crx"
$ChromeKey = "HKLM:\SOFTWARE\Policies\Google\Chrome"
$EdgeKey = "HKLM:\SOFTWARE\Policies\Microsoft\Edge"

function Read-ExtensionId([string]$Current, [string]$Label) {
  $id = $Current
  if ($id -eq "") { $id = Read-Host "Dan ID extension tren $Label (Enter de bo qua)" }
  $id = $id.Trim().ToLower()
  if ($id -eq "") { return "" }
  if ($id -notmatch '^[a-p]{32}$') {
    Write-Host "ID '$id' khong dung: phai la 32 chu cai tu a den p. Dung lai, chua thay doi gi." -ForegroundColor Red
    exit 1
  }
  return $id
}

function Set-Dword([string]$Key, [string]$Name, [int]$Value) {
  if (-not (Test-Path $Key)) { New-Item -Path $Key -Force | Out-Null }
  New-ItemProperty -Path $Key -Name $Name -PropertyType DWord -Value $Value -Force | Out-Null
  Write-Host "  $Name = $Value"
}

# Adds "<id>;<updateUrl>" to <Key>\ExtensionInstallForcelist under the first free number,
# keeping any other entries already there (e.g. a school extension).
function Add-ForceInstall([string]$Key, [string]$Id, [string]$UpdateUrl) {
  $list = Join-Path $Key "ExtensionInstallForcelist"
  if (-not (Test-Path $list)) { New-Item -Path $list -Force | Out-Null }
  $props = Get-ItemProperty -Path $list
  $used = @()
  foreach ($p in $props.PSObject.Properties) {
    if ($p.Name -match '^\d+$') {
      $used += [int]$p.Name
      if ("$($p.Value)".ToLower().StartsWith("$Id;") -or "$($p.Value)".ToLower() -eq $Id) {
        Write-Host "  ExtensionInstallForcelist\$($p.Name) da co $Id - giu nguyen"
        return
      }
    }
  }
  $n = 1
  while ($used -contains $n) { $n++ }
  New-ItemProperty -Path $list -Name "$n" -PropertyType String -Value "$Id;$UpdateUrl" -Force | Out-Null
  Write-Host "  ExtensionInstallForcelist\$n = $Id;$UpdateUrl"
}

$ChromeId = Read-ExtensionId $ChromeId "Chrome Web Store (Chrome)"
$EdgeId = Read-ExtensionId $EdgeId "Edge Add-ons (Edge)"
if ($ChromeId -eq "" -and $EdgeId -eq "") {
  Write-Host "Khong co ID nao. Chua thay doi gi." -ForegroundColor Yellow
  exit 0
}

if ($ChromeId -ne "") {
  Write-Host "Chrome ($ChromeKey):" -ForegroundColor Cyan
  Add-ForceInstall $ChromeKey $ChromeId $ChromeUpdateUrl
  Set-Dword $ChromeKey "IncognitoModeAvailability" 1   # 1 = Incognito disabled
  Set-Dword $ChromeKey "BrowserGuestModeEnabled" 0     # no Guest windows
  Set-Dword $ChromeKey "BrowserAddPersonEnabled" 0     # no new browser profiles
  Set-Dword $ChromeKey "DeveloperToolsAvailability" 2  # 2 = Developer Tools disallowed
}

if ($EdgeId -ne "") {
  Write-Host "Edge ($EdgeKey):" -ForegroundColor Cyan
  Add-ForceInstall $EdgeKey $EdgeId $EdgeUpdateUrl
  Set-Dword $EdgeKey "InPrivateModeAvailability" 1     # 1 = InPrivate disabled
  Set-Dword $EdgeKey "BrowserGuestModeEnabled" 0       # no Guest windows
  Set-Dword $EdgeKey "BrowserAddProfileEnabled" 0      # no new browser profiles
  Set-Dword $EdgeKey "DeveloperToolsAvailability" 2    # 2 = Developer Tools disallowed
}

Write-Host ""
Write-Host "Xong. Dong HET cua so Chrome va Edge, mo lai, roi kiem tra:" -ForegroundColor Green
Write-Host "  chrome://policy  va  edge://policy  -> bam 'Reload policies', cac dong tren o trang thai OK"
Write-Host "  chrome://extensions va edge://extensions -> Study Launcher co nhan 'cai boi quan tri vien', khong co nut Go/Tat"
Write-Host "Extension tu mo trang Ghep may: dang nhap tai khoan cua con, nhap ma 6 so tu trang phu huynh > Thiet bi."
