# Vercel-only step: set env vars and trigger redeploy.
param(
    [Parameter(Mandatory = $true)][string]$ApiHost,
    [Parameter(Mandatory = $true)][string]$VercelToken
)

$ErrorActionPreference = "Stop"
$vercelHeaders = @{
    Authorization = "Bearer $VercelToken"
    "Content-Type" = "application/json"
}
$ApiHost = $ApiHost.TrimEnd("/")

$projectsResp = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects?limit=50" -Headers $vercelHeaders
$map = @{
    "quyhoach-citizen" = "EXPO_PUBLIC_BACKEND_URL"
    "quyhoach-web" = "VITE_API_URL"
}

foreach ($p in $projectsResp.projects) {
    $name = $p.name
    if (-not $map.ContainsKey($name)) { continue }
    $key = $map[$name]
    $projectId = $p.id
    Write-Host "Project $name -> $key"

    $existing = Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$projectId/env" -Headers $vercelHeaders
    foreach ($ev in $existing.envs) {
        if ($ev.key -eq $key) {
            Invoke-RestMethod -Uri "https://api.vercel.com/v9/projects/$projectId/env/$($ev.id)" -Headers $vercelHeaders -Method DELETE | Out-Null
        }
    }

    $envPayload = @(@{
        key = $key
        value = $ApiHost
        target = @("production", "preview", "development")
        type = "encrypted"
    }) | ConvertTo-Json -Depth 5
    Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env" -Headers $vercelHeaders -Method POST -Body $envPayload | Out-Null

    try {
        $depBody = @{
            name = $name
            project = $name
            target = "production"
            gitSource = @{ type = "github"; repo = $p.link.repo; ref = "main" }
        } | ConvertTo-Json -Depth 5
        $dep = Invoke-RestMethod -Uri "https://api.vercel.com/v13/deployments" -Headers $vercelHeaders -Method POST -Body $depBody
        Write-Host "Deploy: $($dep.url)"
    } catch {
        Write-Host "Deploy note: $($_.Exception.Message)"
    }
}
Write-Host "VERCEL_OK"
