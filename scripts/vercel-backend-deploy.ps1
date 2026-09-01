# Deploy FastAPI backend to Vercel + update frontend env vars.
param(
    [Parameter(Mandatory = $true)][string]$MongoUrl,
    [Parameter(Mandatory = $true)][string]$VercelToken
)

$ErrorActionPreference = "Stop"
$vercelHeaders = @{
    Authorization = "Bearer $VercelToken"
    "Content-Type" = "application/json"
}

function Normalize-MongoUrl([string]$url) {
    $u = $url.Trim()
    if ($u -match '^mongodb\+srv://[^/]+/\?') { $u = $u -replace '/\?', '/quyhoach?' }
    elseif ($u -match '^mongodb\+srv://[^/]+/?$') { $u = "$u/quyhoach" }
    elseif ($u -notmatch '/quyhoach') { $u = $u -replace '(\.mongodb\.net)(/|\?)', '$1/quyhoach$2' }
    if ($u -notmatch 'retryWrites=') {
        if ($u -match '\?') { $u = "$u&retryWrites=true&w=majority" }
        else { $u = "$u?retryWrites=true&w=majority" }
    }
    return $u
}

$mongoUrl = Normalize-MongoUrl $MongoUrl
$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$cors = "https://quyhoach-web.vercel.app,https://quyhoach-citizen.vercel.app"
$apiProjectName = "quyhoach-api"

$projectsResp = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects?limit=50" -Headers $vercelHeaders
$apiProject = $projectsResp.projects | Where-Object { $_.name -eq $apiProjectName } | Select-Object -First 1

if (-not $apiProject) {
    Write-Host "Creating Vercel project $apiProjectName..."
    $createBody = @{
        name = $apiProjectName
        framework = $null
        gitRepository = @{
            type = "github"
            repo = "duy8208427/Mobile_app_for_planning"
        }
        rootDirectory = "backend"
    } | ConvertTo-Json -Depth 5
    try {
        $apiProject = Invoke-RestMethod -Uri "https://api.vercel.com/v11/projects" -Headers $vercelHeaders -Method POST -Body $createBody
    } catch {
        Write-Host "Create project note: $($_.ErrorDetails.Message)"
        $projectsResp = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects?limit=50" -Headers $vercelHeaders
        $apiProject = $projectsResp.projects | Where-Object { $_.name -eq $apiProjectName } | Select-Object -First 1
    }
}

if (-not $apiProject) { throw "Could not find or create project $apiProjectName" }
$apiPid = $apiProject.id
Write-Host "API project id: $apiPid"

function Set-ProjectEnv([string]$projectId, [hashtable]$vars) {
    $existing = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$projectId/env" -Headers $vercelHeaders
    foreach ($key in $vars.Keys) {
        foreach ($ev in $existing.envs) {
            if ($ev.key -eq $key) {
                Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$projectId/env/$($ev.id)" -Headers $vercelHeaders -Method DELETE | Out-Null
            }
        }
        $payload = @(@{
            key = $key
            value = $vars[$key]
            target = @("production", "preview", "development")
            type = "encrypted"
        }) | ConvertTo-Json -Depth 5
        Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env" -Headers $vercelHeaders -Method POST -Body $payload | Out-Null
        Write-Host "Set env $key on $projectId"
    }
}

Set-ProjectEnv $apiPid @{
    MONGO_URL = $mongoUrl
    DB_NAME = "quyhoach"
    JWT_SECRET = $jwtSecret
    CORS_ORIGINS = $cors
}

$projectDetail = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$apiPid" -Headers $vercelHeaders
$repoId = $projectDetail.link.repoId
if (-not $repoId) { throw "Project has no git repoId" }

Write-Host "Deploying API (repoId=$repoId)..."
$depBody = @{
    name = $apiProjectName
    project = $apiProjectName
    target = "production"
    gitSource = @{
        type = "github"
        repoId = $repoId
        ref = "main"
    }
} | ConvertTo-Json -Depth 5
$dep = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments" -Headers $vercelHeaders -Method POST -Body $depBody
Write-Host "Deployment: $($dep.url) state=$($dep.readyState)"

$apiHost = $null
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 15
    try {
        $d = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments/$($dep.id)" -Headers $vercelHeaders
        if ($d.url) {
            $candidate = "https://$($d.url)"
            Write-Host "Try $candidate ready=$($d.readyState)"
            if ($d.readyState -eq "READY") {
                $h = Invoke-WebRequest -Uri "$candidate/health" -UseBasicParsing -TimeoutSec 60
                if ($h.StatusCode -eq 200 -and $h.Content -match '"ok"\s*:\s*true') {
                    $apiHost = $candidate
                    Write-Host "HEALTH_OK $apiHost"
                    break
                }
            }
        }
    } catch {
        Write-Host "wait $i : $($_.Exception.Message)"
    }
}

if (-not $apiHost) {
    $aliases = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$apiPid/domains" -Headers $vercelHeaders
    foreach ($a in $aliases.domains) {
        if ($a.verified) {
            $candidate = "https://$($a.name)"
            try {
                $h = Invoke-WebRequest -Uri "$candidate/health" -UseBasicParsing -TimeoutSec 60
                if ($h.StatusCode -eq 200) { $apiHost = $candidate; break }
            } catch {}
        }
    }
}
if (-not $apiHost) {
    $apiHost = "https://quyhoach-api.vercel.app"
}

Write-Host "Using API host: $apiHost"

$map = @{
    "quyhoach-citizen" = "EXPO_PUBLIC_BACKEND_URL"
    "quyhoach-web" = "VITE_API_URL"
}
foreach ($p in $projectsResp.projects) {
    if (-not $map.ContainsKey($p.name)) { continue }
    Set-ProjectEnv $p.id @{ $map[$p.name] = $apiHost }
    try {
        $pd = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$($p.id)" -Headers $vercelHeaders
        $dep2Body = @{
            name = $p.name
            project = $p.name
            target = "production"
            gitSource = @{
                type = "github"
                repoId = $pd.link.repoId
                ref = "main"
            }
        } | ConvertTo-Json -Depth 5
        $dep2 = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments" -Headers $vercelHeaders -Method POST -Body $dep2Body
        Write-Host "Redeploy $($p.name): $($dep2.url)"
    } catch {
        Write-Host "Redeploy $($p.name) note: $($_.Exception.Message)"
    }
}

Write-Host "DONE apiHost=$apiHost"
