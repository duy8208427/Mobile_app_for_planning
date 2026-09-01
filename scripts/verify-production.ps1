# Verify production API (Render) then optional login.
# Usage:
#   .\scripts\verify-production.ps1
#   .\scripts\verify-production.ps1 -ApiBase "https://your-service.onrender.com"

param(
    [string]$ApiBase = "https://quyhoach-api.onrender.com"
)

$ErrorActionPreference = "Continue"
$ApiBase = $ApiBase.TrimEnd("/")

function Probe([string]$Url) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 90
        Write-Host "OK  $($r.StatusCode) $Url"
        Write-Host "    $($r.Content.Substring(0, [Math]::Min(160, $r.Content.Length)))"
        return $true
    } catch {
        $code = $null
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        Write-Host "FAIL $Url code=$code $($_.Exception.Message)"
        return $false
    }
}

Write-Host "API = $ApiBase"
$okHealth = Probe "$ApiBase/health"
$okRoot = Probe "$ApiBase/api/"

if (-not ($okHealth -or $okRoot)) {
    Write-Host ""
    Write-Host "API chua song. Tren Render: dán MONGO_URL Atlas, Network Access 0.0.0.0/0, doi deploy xong (lan dau co the 30-60s)."
    exit 1
}

Write-Host ""
Write-Host "Health OK. Tiep theo tren Vercel Redeploy:"
Write-Host "  quyhoach-citizen  EXPO_PUBLIC_BACKEND_URL=$ApiBase"
Write-Host "  quyhoach-web      VITE_API_URL=$ApiBase"
exit 0
