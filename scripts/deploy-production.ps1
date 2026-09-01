# One-shot deploy: Render API + Vercel env. Secrets via parameters only — never commit.
param(
    [Parameter(Mandatory = $true)][string]$MongoUrl,
    [Parameter(Mandatory = $true)][string]$RenderKey,
    [Parameter(Mandatory = $true)][string]$VercelToken
)

$ErrorActionPreference = "Stop"
$renderHeaders = @{
    Authorization = "Bearer $RenderKey"
    "Content-Type" = "application/json"
    Accept = "application/json"
}
$vercelHeaders = @{
    Authorization = "Bearer $VercelToken"
    "Content-Type" = "application/json"
}

function Normalize-MongoUrl([string]$url) {
    $u = $url.Trim()
    if ($u -match '^mongodb\+srv://[^/]+/\?') {
        $u = $u -replace '/\?', '/quyhoach?'
    } elseif ($u -match '^mongodb\+srv://[^/]+/?$') {
        $u = "$u/quyhoach"
    } elseif ($u -notmatch '/quyhoach') {
        $u = $u -replace '(\.mongodb\.net)(/|\?)', '$1/quyhoach$2'
    }
    if ($u -notmatch 'retryWrites=') {
        if ($u -match '\?') { $u = "$u&retryWrites=true&w=majority" }
        else { $u = "$u?retryWrites=true&w=majority" }
    }
    return $u
}

$mongoUrl = Normalize-MongoUrl $MongoUrl
Write-Host "MONGO_URL normalized (db=quyhoach)"

$ownerId = $null
try {
    $owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners?limit=20" -Headers $renderHeaders
    if ($owners.Count -gt 0) {
        $ownerId = $owners[0].owner.id
        Write-Host "Render owner: $($owners[0].owner.name) ($ownerId)"
    }
} catch {
    throw "Render API owners failed: $($_.Exception.Message)"
}
if (-not $ownerId) { throw "No Render owner found" }

$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$cors = "https://quyhoach-web.vercel.app,https://quyhoach-citizen.vercel.app"

function Get-RenderService {
    $cursor = $null
    do {
        $uri = "https://api.render.com/v1/services?limit=50"
        if ($cursor) { $uri += "&cursor=$cursor" }
        $resp = Invoke-RestMethod -Uri $uri -Headers $renderHeaders
        foreach ($item in $resp) {
            if ($item.service.name -eq "quyhoach-api") { return $item.service }
        }
        $cursor = $null
        if ($resp.Count -gt 0 -and $resp[-1].cursor) { $cursor = $resp[-1].cursor }
    } while ($cursor)
    return $null
}

function Test-RenderRepoAccess([string]$ownerId) {
    try {
        $repos = Invoke-RestMethod -Uri "https://api.render.com/v1/owners/$ownerId/repos?limit=100" -Headers $renderHeaders
        foreach ($item in $repos) {
            $r = $item.repo
            if ($r.name -eq "Mobile_app_for_planning" -and $r.ownerName -eq "duy8208427") {
                return $true
            }
        }
    } catch {
        Write-Host "Could not list Render repos: $($_.Exception.Message)"
    }
    return $false
}

function Wait-RenderRepoAccess([string]$ownerId) {
    if (Test-RenderRepoAccess $ownerId) { return $true }
    Write-Host ""
    Write-Host "Render chua truy cap duoc repo GitHub private."
    Write-Host "Mo trang cap quyen Render GitHub App (chon repo Mobile_app_for_planning)..."
    Start-Process "https://github.com/apps/render/installations/new"
    Start-Process "https://dashboard.render.com/u/settings#integrations"
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 15
        if (Test-RenderRepoAccess $ownerId) {
            Write-Host "Repo da xuat hien trong Render."
            return $true
        }
        Write-Host "Cho GitHub ket noi Render... ($i)"
    }
    return $false
}

if (-not (Wait-RenderRepoAccess $ownerId)) {
    throw "Render chua ket noi GitHub repo duy8208427/Mobile_app_for_planning. Vao dashboard.render.com > Account Settings > Git, hoac cai Render GitHub App cho repo nay."
}

$service = Get-RenderService
if (-not $service) {
    Write-Host "Creating Render service quyhoach-api..."
    $body = @{
        type = "web_service"
        name = "quyhoach-api"
        ownerId = $ownerId
        repo = "https://github.com/duy8208427/Mobile_app_for_planning"
        branch = "main"
        rootDir = "backend"
        autoDeploy = "yes"
        envVars = @(
            @{ key = "MONGO_URL"; value = $mongoUrl }
            @{ key = "DB_NAME"; value = "quyhoach" }
            @{ key = "JWT_SECRET"; value = $jwtSecret }
            @{ key = "CORS_ORIGINS"; value = $cors }
            @{ key = "PYTHON_VERSION"; value = "3.11.9" }
        )
        serviceDetails = @{
            runtime = "python"
            plan = "free"
            region = "singapore"
            healthCheckPath = "/health"
            envSpecificDetails = @{
                buildCommand = "pip install -r requirements.txt"
                startCommand = "uvicorn server:app --host 0.0.0.0 --port `$PORT"
            }
        }
    } | ConvertTo-Json -Depth 8
    $created = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Headers $renderHeaders -Method POST -Body $body
    $service = $created.service
} else {
    Write-Host "Updating env on existing service $($service.id)..."
    $envBody = @(
        @{ key = "MONGO_URL"; value = $mongoUrl }
        @{ key = "DB_NAME"; value = "quyhoach" }
        @{ key = "JWT_SECRET"; value = $jwtSecret }
        @{ key = "CORS_ORIGINS"; value = $cors }
        @{ key = "PYTHON_VERSION"; value = "3.11.9" }
    ) | ConvertTo-Json -Depth 3
    Invoke-RestMethod -Uri "https://api.render.com/v1/services/$($service.id)/env-vars" -Headers $renderHeaders -Method PUT -Body $envBody | Out-Null
    Invoke-RestMethod -Uri "https://api.render.com/v1/services/$($service.id)/deploys" -Headers $renderHeaders -Method POST -Body "{}" | Out-Null
}

$serviceId = $service.id
Write-Host "Render service id: $serviceId"

$apiHost = $null
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 15
    try {
        $detail = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId" -Headers $renderHeaders
        $svc = $detail.service
        if ($svc.serviceDetails.url) {
            $apiHost = ($svc.serviceDetails.url -replace "/$", "")
            Write-Host "Render URL: $apiHost suspended=$($svc.suspended)"
        }
        if ($apiHost) {
            $h = Invoke-WebRequest -Uri "$apiHost/health" -UseBasicParsing -TimeoutSec 30
            if ($h.StatusCode -eq 200 -and $h.Content -match '"ok"\s*:\s*true') {
                Write-Host "Health OK"
                break
            }
        }
    } catch {
        Write-Host "Waiting deploy... ($i)"
    }
}

if (-not $apiHost) {
    $apiHost = "https://quyhoach-api.onrender.com"
    Write-Host "Fallback host: $apiHost"
}

Write-Host "Configuring Vercel..."
$projectsResp = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects?limit=50" -Headers $vercelHeaders
$map = @{
    "quyhoach-citizen" = "EXPO_PUBLIC_BACKEND_URL"
    "quyhoach-web" = "VITE_API_URL"
}

foreach ($p in $projectsResp.projects) {
    $name = $p.name
    if (-not $map.ContainsKey($name)) { continue }
    $key = $map[$name]
    $pid = $p.id
    Write-Host "Project $name -> $key = $apiHost"

    $existing = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$pid/env" -Headers $vercelHeaders
    foreach ($ev in $existing.envs) {
        if ($ev.key -eq $key) {
            Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$pid/env/$($ev.id)" -Headers $vercelHeaders -Method DELETE | Out-Null
        }
    }

    $envPayload = @(
        @{
            key = $key
            value = $apiHost
            target = @("production", "preview", "development")
            type = "encrypted"
        }
    ) | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$pid/env" -Headers $vercelHeaders -Method POST -Body $envPayload | Out-Null

    try {
        $gitRepo = $p.link.repo
        $depBody = @{
            name = $name
            project = $name
            target = "production"
            gitSource = @{
                type = "github"
                repo = $gitRepo
                ref = "main"
            }
        } | ConvertTo-Json -Depth 5
        $dep = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments" -Headers $vercelHeaders -Method POST -Body $depBody
        Write-Host "Deployment triggered: $($dep.url)"
    } catch {
        Write-Host "Deploy trigger note: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "DONE apiHost=$apiHost"
Write-Host "Citizen: https://quyhoach-citizen.vercel.app/login"
Write-Host "Admin: https://quyhoach-web.vercel.app"
