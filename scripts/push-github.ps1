# Push repo lên GitHub (chạy sau khi tạo repo trên github.com/new)

param(
    [Parameter(Mandatory = $true)]
    [string]$GitHubUser,

    [Parameter(Mandatory = $true)]
    [string]$RepoName
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

# Không push nếu .env bị track
$trackedEnv = git ls-files | Select-String -Pattern "\.env$|backend/\.env|web/\.env|frontend/\.env"
if ($trackedEnv) {
    Write-Error "Phát hiện file .env trong git — hãy xóa khỏi index trước khi push."
}

if (-not (Test-Path ".git")) {
    Write-Error "Chưa có git repo. Chạy: git init; git add .; git commit -m 'Initial commit'"
}

$remoteUrl = "https://github.com/$GitHubUser/$RepoName.git"
$existing = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    git remote add origin $remoteUrl
} else {
    git remote set-url origin $remoteUrl
}

git branch -M main
git push -u origin main

Write-Host ""
Write-Host "Done. Repo: https://github.com/$GitHubUser/$RepoName"
Write-Host "Tiếp theo: Render (backend) + Vercel (web) — xem HUONG-DAN-WEB.md"
