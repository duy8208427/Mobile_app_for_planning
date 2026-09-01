# Wizard tu trien khai. Chay trong thu muc repo:
#   powershell -ExecutionPolicy Bypass -File .\scripts\self-deploy.ps1
#
# Khong tao tai khoan ho ban. In checklist + chuan bi git local.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Find-Git {
    $g = Get-Command git -ErrorAction SilentlyContinue
    if ($g) { return $g.Source }
    foreach ($p in @(
        "C:\Program Files\Git\cmd\git.exe",
        "C:\Program Files (x86)\Git\cmd\git.exe"
    )) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

Write-Host ""
Write-Host "===== 1. MongoDB Atlas ====="
Write-Host "Mo: https://www.mongodb.com/cloud/atlas/register"
Write-Host "  - Cluster M0 FREE, region Singapore (ap-southeast-1)"
Write-Host "  - Database Access: tao user + password"
Write-Host "  - Network Access: Allow Access from Anywhere  0.0.0.0/0"
Write-Host "  - Connect > Drivers. Chen DB quyhoach:"
Write-Host "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/quyhoach?retryWrites=true&w=majority"
Write-Host "  (@ trong password doi thanh %40)"
Write-Host ""

Write-Host "===== 2. Git + GitHub ====="
$git = Find-Git
if (-not $git) {
    Write-Host "Chua co Git. Cai: https://git-scm.com/download/win  roi mo lai PowerShell."
    Write-Host "Hoac: winget install --id Git.Git -e --source winget"
    exit 1
}
Write-Host "Git: $git"

if (-not (Test-Path (Join-Path $Root ".git"))) {
    & $git init -b main
    Write-Host "Da git init (nhanh main)."
}

$envTracked = & $git ls-files 2>$null | Select-String -Pattern '\.env$'
if ($envTracked) {
    Write-Host "CANH BAO: file .env dang nam trong git. Bo ra truoc khi push."
    Write-Host $envTracked
}

Write-Host "Repo GitHub da co: https://github.com/duy8208427/Mobile_app_for_planning"
Write-Host "Neu chua push commit moi, chay (se hoi dang nhap GitHub):"
Write-Host "  git push -u origin main"
Write-Host ""

Write-Host "===== 3. Render ====="
Write-Host "Mo: https://dashboard.render.com"
Write-Host "  New > Blueprint  HOAC  Web Service, Root Directory = backend"
Write-Host "  Build: pip install -r requirements.txt"
Write-Host "  Start: uvicorn server:app --host 0.0.0.0 --port `$PORT"
Write-Host "  Health: /health"
Write-Host "  Dan MONGO_URL (buoc 1). JWT_SECRET tu generate."
Write-Host "Kiem tra:  .\scripts\verify-production.ps1 -ApiBase `"https://HOST.onrender.com`""
Write-Host ""

Write-Host "===== 4. Vercel ====="
Write-Host "Citizen (frontend/): EXPO_PUBLIC_BACKEND_URL=https://HOST.onrender.com"
Write-Host "Admin (web/):        VITE_API_URL=https://HOST.onrender.com"
Write-Host "Roi Redeploy (bat buoc)."
Write-Host ""

Write-Host "===== 5. Dang nhap ====="
Write-Host "citizen@quyhoach.vn / Citizen@123"
Write-Host "admin@quyhoach.vn  / Admin@123"
Write-Host ""
Write-Host "Xong phan may local. Tiep tuc tren trinh duyet theo 5 muc tren."
