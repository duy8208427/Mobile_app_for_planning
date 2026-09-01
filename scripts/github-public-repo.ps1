# Try to obtain GitHub token via git credential helper and make repo public for Render.
$ErrorActionPreference = "Stop"
$repo = "duy8208427/Mobile_app_for_planning"

function Get-GitHubToken {
    $inputText = "protocol=https`nhost=github.com`n`n"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "git"
    $psi.Arguments = "credential fill"
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $p = [System.Diagnostics.Process]::Start($psi)
    $p.StandardInput.Write($inputText)
    $p.StandardInput.Close()
    $out = $p.StandardOutput.ReadToEnd()
    $p.WaitForExit()
    if ($out -match 'password=([^\r\n]+)') { return $Matches[1] }
    if ($out -match 'username=([^\r\n]+)') { return $Matches[1] }
    return $null
}

$token = Get-GitHubToken
if (-not $token) { throw "No GitHub token from git credential helper" }
Write-Host "Got GitHub credential (not printing)"

$headers = @{
    Authorization = "Bearer $token"
    Accept = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

$repoInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo" -Headers $headers
Write-Host "Repo: $($repoInfo.full_name) private=$($repoInfo.private)"

if ($repoInfo.private) {
    Write-Host "Making repo public temporarily for Render deploy..."
    $body = @{ private = $false } | ConvertTo-Json
    Invoke-RestMethod -Uri "https://api.github.com/repos/$repo" -Headers $headers -Method PATCH -Body $body -ContentType "application/json" | Out-Null
    Write-Host "Repo is now public"
} else {
    Write-Host "Repo already public"
}

# Verify public access
Start-Sleep -Seconds 3
try {
    $pub = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo" -TimeoutSec 20
    Write-Host "Public check: name=$($pub.name) private=$($pub.private)"
} catch {
    Write-Host "Public check failed: $($_.Exception.Message)"
}
