param([Parameter(Mandatory=$true)][string]$RenderKey)
$ErrorActionPreference = "Continue"
$h = @{ Authorization = "Bearer $RenderKey"; Accept = "application/json" }
$paths = @(
    "https://api.render.com/v1/owners/tea-cspv8v0gph6c73d0p6v0/repos",
    "https://api.render.com/v1/registries",
    "https://api.render.com/v1/blueprints",
    "https://api.render.com/v1/services?limit=5"
)
foreach ($p in $paths) {
    Write-Host "`n=== $p ==="
    try {
        $r = Invoke-RestMethod -Uri $p -Headers $h
        ($r | ConvertTo-Json -Depth 3).Substring(0, [Math]::Min(800, ($r | ConvertTo-Json -Depth 3).Length))
    } catch {
        Write-Host "ERR: $($_.Exception.Message)"
        if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message.Substring(0, [Math]::Min(400, $_.ErrorDetails.Message.Length)) }
    }
}
