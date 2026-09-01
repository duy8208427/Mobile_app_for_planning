$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$secrets = Join-Path $Root ".deploy-local.ps1"
if (-not (Test-Path $secrets)) {
    throw "Missing $secrets. Create it with MONGO_URL, RENDER_API_KEY, VERCEL_TOKEN."
}
. $secrets
& (Join-Path $Root "deploy-production.ps1") -MongoUrl $MongoUrl -RenderKey $RenderKey -VercelToken $VercelToken
