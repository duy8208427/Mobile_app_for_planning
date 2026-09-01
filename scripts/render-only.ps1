# Render-only step: create/update service and poll health.
param(
    [Parameter(Mandatory = $true)][string]$MongoUrl,
    [Parameter(Mandatory = $true)][string]$RenderKey
)

$ErrorActionPreference = "Stop"
$renderHeaders = @{
    Authorization = "Bearer $RenderKey"
    "Content-Type" = "application/json"
    Accept = "application/json"
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
$owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners?limit=20" -Headers $renderHeaders
$ownerId = $owners[0].owner.id
Write-Host "Owner: $($owners[0].owner.name) ($ownerId)"

$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$cors = "https://quyhoach-web.vercel.app,https://quyhoach-citizen.vercel.app"

$service = $null
$resp = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=50" -Headers $renderHeaders
foreach ($item in $resp) {
    if ($item.service.name -eq "quyhoach-api") { $service = $item.service; break }
}

if (-not $service) {
    Write-Host "Creating service..."
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
    try {
        $created = Invoke-RestMethod -Uri "https://api.render.com/v1/services" -Headers $renderHeaders -Method POST -Body $body
        $service = $created.service
    } catch {
        Write-Host "Create failed: $($_.ErrorDetails.Message)"
        exit 1
    }
} else {
    Write-Host "Updating service $($service.id)..."
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
$apiHost = $null
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 15
    try {
        $detail = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId" -Headers $renderHeaders
        $svc = $detail.service
        if ($svc.serviceDetails.url) {
            $apiHost = ($svc.serviceDetails.url -replace "/$", "")
            Write-Host "URL: $apiHost"
        }
        if ($apiHost) {
            $h = Invoke-WebRequest -Uri "$apiHost/health" -UseBasicParsing -TimeoutSec 30
            if ($h.StatusCode -eq 200 -and $h.Content -match '"ok"\s*:\s*true') {
                Write-Host "HEALTH_OK $apiHost"
                exit 0
            }
        }
    } catch {
        Write-Host "wait $i"
    }
}
Write-Host "TIMEOUT host=$apiHost"
exit 1
