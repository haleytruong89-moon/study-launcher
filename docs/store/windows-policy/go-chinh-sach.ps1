# Study Launcher - UNDO of cai-chinh-sach.ps1 (docs/SETUP.md part C).
# Removes ONLY what cai-chinh-sach.ps1 sets: the Study Launcher force-install entries and the
# hardening values. Other browser policies on this laptop are left alone.
# After this, the child CAN remove / turn off the extension and use Incognito / InPrivate again.
#
# Run as administrator:
#   powershell -ExecutionPolicy Bypass -File .\go-chinh-sach.ps1
# It asks for the extension IDs (Enter = remove any entry whose ID you paste; empty = skip).

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

$ChromeKey = "HKLM:\SOFTWARE\Policies\Google\Chrome"
$EdgeKey = "HKLM:\SOFTWARE\Policies\Microsoft\Edge"

function Read-ExtensionId([string]$Current, [string]$Label) {
  $id = $Current
  if ($id -eq "") { $id = Read-Host "ID extension tren $Label can go (Enter de bo qua)" }
  return $id.Trim().ToLower()
}

function Remove-Value([string]$Key, [string]$Name) {
  if ((Test-Path $Key) -and ($null -ne (Get-ItemProperty -Path $Key -Name $Name -ErrorAction SilentlyContinue))) {
    Remove-ItemProperty -Path $Key -Name $Name
    Write-Host "  da xoa $Name"
  }
}

function Remove-ForceInstall([string]$Key, [string]$Id) {
  if ($Id -eq "") { return }
  $list = Join-Path $Key "ExtensionInstallForcelist"
  if (-not (Test-Path $list)) { return }
  $props = Get-ItemProperty -Path $list
  foreach ($p in $props.PSObject.Properties) {
    if ($p.Name -match '^\d+$') {
      $v = "$($p.Value)".ToLower()
      if ($v -eq $Id -or $v.StartsWith("$Id;")) {
        Remove-ItemProperty -Path $list -Name $p.Name
        Write-Host "  da xoa ExtensionInstallForcelist\$($p.Name) ($Id)"
      }
    }
  }
  if (@((Get-Item -Path $list).Property).Count -eq 0) { Remove-Item -Path $list }
}

$ChromeId = Read-ExtensionId $ChromeId "Chrome"
$EdgeId = Read-ExtensionId $EdgeId "Edge"

Write-Host "Chrome:" -ForegroundColor Cyan
Remove-ForceInstall $ChromeKey $ChromeId
foreach ($n in "IncognitoModeAvailability", "BrowserGuestModeEnabled", "BrowserAddPersonEnabled", "DeveloperToolsAvailability") { Remove-Value $ChromeKey $n }

Write-Host "Edge:" -ForegroundColor Cyan
Remove-ForceInstall $EdgeKey $EdgeId
foreach ($n in "InPrivateModeAvailability", "BrowserGuestModeEnabled", "BrowserAddProfileEnabled", "DeveloperToolsAvailability") { Remove-Value $EdgeKey $n }

Write-Host ""
Write-Host "Xong. Dong het cua so Chrome/Edge va mo lai. Extension da cai bang chinh sach se tu go." -ForegroundColor Green
